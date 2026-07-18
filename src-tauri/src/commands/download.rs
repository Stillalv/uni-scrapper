use tauri::Emitter;
use std::path::PathBuf;
use std::fs;
use std::io::Write;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use futures::stream::{self, StreamExt};

#[tauri::command]
pub async fn download_images_direct(
    window: tauri::Window,
    urls: Vec<String>,
    folder_path: String,
    referer: String,
    thread_count: usize,
    ext: String,
) -> Result<u32, String> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"));
    headers.insert("Referer", HeaderValue::from_str(&referer).map_err(|e| e.to_string())?);

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| e.to_string())?;

    let folder = PathBuf::from(&folder_path);
    if !folder.exists() {
        fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    }

    let tasks: Vec<(usize, String)> = urls.into_iter().enumerate().collect();
    
    let successes = stream::iter(tasks)
        .map(|(idx, url)| {
            let client = client.clone();
            let folder = folder.clone();
            let window = window.clone();
            let ext = ext.clone();
            async move {
                let file_name = format!("{:03}{}", idx + 1, ext);
                let file_path = folder.join(file_name);
                
                if file_path.exists() {
                    let _ = window.emit("image-downloaded", idx);
                    return true;
                }

                for _attempt in 1..=3 {
                    match client.get(&url).send().await {
                        Ok(res) => {
                            if res.status().is_success() {
                                if let Ok(bytes) = res.bytes().await {
                                    if let Ok(mut file) = fs::File::create(&file_path) {
                                        if file.write_all(&bytes).is_ok() {
                                            let _ = window.emit("image-downloaded", idx);
                                            return true;
                                        }
                                    }
                                }
                            }
                        }
                        Err(_) => {
                            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                        }
                    }
                }
                false
            }
        })
        .buffer_unordered(thread_count)
        .fold(0u32, |acc, success| async move {
            if success { acc + 1 } else { acc }
        })
        .await;

    Ok(successes)
}

#[tauri::command]
pub async fn create_cbz(source_dir: String, target_path: String) -> Result<(), String> {
    use std::fs::File;
    use zip::write::FileOptions;
    use zip::ZipWriter;

    let file = File::create(&target_path).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let src_path = std::path::Path::new(&source_dir);
    let paths = fs::read_dir(src_path).map_err(|e| e.to_string())?;
    for path_entry in paths {
        let entry = path_entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            let name = path.file_name().ok_or("No file name")?.to_str().ok_or("Invalid path")?;
            
            if name.ends_with(".cbz") || name.ends_with(".pdf") {
                continue;
            }

            zip.start_file(name, options).map_err(|e| e.to_string())?;
            let mut f = File::open(&path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        }
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn create_pdf(source_dir: String, target_path: String) -> Result<(), String> {
    use printpdf::*;
    use std::fs::File;
    use std::io::BufWriter;

    let src_path = std::path::Path::new(&source_dir);
    let mut paths: Vec<_> = fs::read_dir(src_path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .collect();

    paths.sort_by_key(|e| e.file_name());

    let mut doc: Option<PdfDocumentReference> = None;
    let mut image_count = 0;

    for entry in paths {
        let path = entry.path();
        if path.is_file() {
            let name = path.file_name().ok_or("No file name")?.to_str().ok_or("Invalid path")?;
            if name.ends_with("ComicInfo.xml") || name.ends_with(".cbz") || name.ends_with(".pdf") {
                continue;
            }

            let img_decoded = match ::image::open(&path) {
                Ok(img) => img,
                Err(_) => continue, 
            };

            let width_px = img_decoded.width() as f64;
            let height_px = img_decoded.height() as f64;

            let width_pt = width_px * 0.75;
            let height_pt = height_px * 0.75;

            let page_w: Mm = Pt(width_pt as f32).into();
            let page_h: Mm = Pt(height_pt as f32).into();

            let (current_page, current_layer) = if image_count == 0 {
                let (doc_ref, page, layer) = PdfDocument::new("Webtoon Chapter", page_w, page_h, "Layer 1");
                doc = Some(doc_ref);
                (page, layer)
            } else {
                doc.as_ref().unwrap().add_page(page_w, page_h, "Layer 1")
            };

            let layer_ref = doc.as_ref().unwrap().get_page(current_page).get_layer(current_layer);

            let dynamic_image = ::image::DynamicImage::ImageRgb8(img_decoded.to_rgb8());
            let img_object = Image::from_dynamic_image(&dynamic_image);

            img_object.add_to_layer(
                layer_ref,
                ImageTransform {
                    translate_x: Some(Mm(0.0)),
                    translate_y: Some(Mm(0.0)),
                    scale_x: Some(width_pt as f32),
                    scale_y: Some(height_pt as f32),
                    dpi: Some(96.0 as f32),
                    ..Default::default()
                },
            );

            image_count += 1;
        }
    }

    if let Some(doc_ref) = doc {
        let pdf_file = File::create(&target_path).map_err(|e| e.to_string())?;
        let mut writer = BufWriter::new(pdf_file);
        doc_ref.save(&mut writer).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No images found to create PDF".to_string())
    }
}
