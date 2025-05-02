// Callback function for body segmentation
function gotResults(result) {
    segmentation = result;
    
    // Check if a person is present in the frame
    if (segmentation && segmentation.mask) {
      // Check if there are any body parts detected by sampling some pixels
      let hasBodyParts = false;
      segmentation.mask.loadPixels();
      
      for (let i = 0; i < segmentation.mask.pixels.length; i += 4) {
        // If any semi-transparent pixel is found in the mask
        if (segmentation.mask.pixels[i + 3] < 255) {
          hasBodyParts = true;
          break;
        }
      }
      
     // 检测人物状态变化
    const wasPresent = personPresent;
    personPresent = hasBodyParts;
    
    // 如果人从存在变为不存在（刚离开画面）
    if (wasPresent && !personPresent) {
      console.log("Person left frame, resetting capture timer");
      // 重置捕获时间，这样当人再次进入时需要重新等待3秒
      lastCaptureTime = millis(); // 设为当前时间，相当于重新开始计时
    }
    
    if (personPresent) {
      // Reset the counter if a person is detected
      personAbsentFrames = 0;
      
      // Check if it's time to capture a new segment
      const currentTime = millis();
      if (currentTime - lastCaptureTime >= captureInterval) {
        captureBodySegment();
        lastCaptureTime = currentTime;
      }
      } 
    }
  }




  // Function to extract person from video using mask
  function copyPersonPixels(videoImg, maskImg, resultImg) {
    videoImg.loadPixels();
    maskImg.loadPixels();
    resultImg.loadPixels();
    
    const totalPixels = resultImg.pixels.length;
    const imgChannels = 4;
    
    for (let i = 0; i < totalPixels; i += imgChannels) {
      // Check alpha channel of mask
      let maskAlpha = maskImg.pixels[i + 3];
      
      if (maskAlpha === 255) {
        // If mask pixel is fully opaque (background), make result transparent
        resultImg.pixels[i + 3] = 0;
      } else {
        // If mask pixel is not fully opaque (person), copy video pixel
        resultImg.pixels[i] = videoImg.pixels[i];
        resultImg.pixels[i + 1] = videoImg.pixels[i + 1];
        resultImg.pixels[i + 2] = videoImg.pixels[i + 2];
        resultImg.pixels[i + 3] = 255; // Fully opaque
      }
    }
    
    resultImg.updatePixels();
  }
  
  // 添加新函数用于测量图像有效内容区域
  function measureImageContent(img) {
    img.loadPixels();
    
    // 初始化边界
    let minX = img.width;
    let minY = img.height;
    let maxX = 0;
    let maxY = 0;
    let hasContent = false;
    
    // 扫描图像查找非透明像素
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        let index = (y * img.width + x) * 4;
        let alpha = img.pixels[index + 3];
        
        if (alpha > 0) { // 非透明像素
          minX = min(minX, x);
          minY = min(minY, y);
          maxX = max(maxX, x);
          maxY = max(maxY, y);
          hasContent = true;
        }
      }
    }
    
    // 如果没有内容，返回默认值
    if (!hasContent) {
      return {
        width: img.width,
        height: img.height,
        aspect: 1,
        isEmpty: true
      };
    }
    
    // 计算有效内容区域
    let contentWidth = maxX - minX + 1;
    let contentHeight = maxY - minY + 1;
    let aspectRatio = contentWidth / contentHeight;
    
    return {
      x: minX,
      y: minY,
      width: contentWidth,
      height: contentHeight,
      aspect: aspectRatio,
      isEmpty: false
    };
  }






  
  // 添加这个函数来提取简化的轮廓点
  function extractSimplifiedContour(maskImg) {
    const SIMPLIFY_FACTOR = 10; // 越大越粗糙，但更稳定
    const MIN_POINTS = 6;       // 最少点数
    const MAX_POINTS = 16;      // 最多点数（Matter.js处理高效）
    
    // 存储重要点
    let points = [];
    
    // 加载像素数据
    maskImg.loadPixels();
    
    // 首先找到边界框
    let minX = maskImg.width;
    let minY = maskImg.height;
    let maxX = 0;
    let maxY = 0;
    let hasContent = false;
    
    for (let y = 0; y < maskImg.height; y++) {
      for (let x = 0; x < maskImg.width; x++) {
        let index = (y * maskImg.width + x) * 4;
        if (maskImg.pixels[index + 3] < 255) { // 人物像素
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          hasContent = true;
        }
      }
    }
    
    if (!hasContent) return null;
    
    // 在边界上采样点
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // 使用极坐标方法 - 从中心向外发射射线，寻找轮廓
    const numRays = MAX_POINTS;
    
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      let foundPoint = false;
      
      // 从边界框对角线长度开始往内找
      const maxDist = Math.sqrt(maskImg.width * maskImg.width + maskImg.height * maskImg.height) / 2;
      
      for (let r = maxDist; r > 0; r--) {
        const x = Math.round(centerX + Math.cos(angle) * r);
        const y = Math.round(centerY + Math.sin(angle) * r);
        
        // 检查点是否在图像范围内
        if (x < 0 || x >= maskImg.width || y < 0 || y >= maskImg.height) continue;
        
        const index = (y * maskImg.width + x) * 4;
        // 找到边缘点 - 判断此点是否为人物像素
        if (maskImg.pixels[index + 3] < 255) {
          points.push({ x: x - minX, y: y - minY });
          foundPoint = true;
          break;
        }
      }
      
      if (!foundPoint) {
        // 如果没有找到点，使用最大半径(向内缩小一点)
        const x = Math.round(centerX + Math.cos(angle) * (maxDist * 0.8));
        const y = Math.round(centerY + Math.sin(angle) * (maxDist * 0.8));
        points.push({ x: x - minX, y: y - minY });
      }
    }
    
    // 确保有足够的点，否则返回null
    if (points.length < MIN_POINTS) return null;
    
    return {
      points: points,
      width: maxX - minX,
      height: maxY - minY,
      x: minX,
      y: minY
    };
  }
  
 




  function captureBodySegment() {
    if (!segmentation || !segmentation.mask) return;
    
    // 创建当前分割的副本
    let capturedImage = createImage(video.width, video.height);
    
    // 使用mask从视频中提取人物
    copyPersonPixels(video, segmentation.mask, capturedImage);
    
    // 测量图像内容
    let content = measureImageContent(capturedImage);
    
    // 如果图像为空，跳过创建
    if (content.isEmpty) return;
    
    // 提取简化轮廓
    const contour = extractSimplifiedContour(segmentation.mask);
    
    // 基于内容计算尺寸
    const maxSize = min(400, width/8);
    let sizeW, sizeH;
    
    if (content.aspect > 1) {
      sizeW = maxSize;
      sizeH = maxSize / content.aspect;
    } else {
      sizeH = maxSize;
      sizeW = maxSize * content.aspect;
    }
    
    // 计算比例因子
    const scaleFactorW = sizeW / content.width;
    const scaleFactorH = sizeH / content.height;
    
    // 生成随机位置的代码
    // 设置安全边距，防止物体生成在墙内
    const safeMargin = 30; // 距离墙壁的安全距离
    
    // 计算可用区域宽度并均匀分成5个区域
    const availableWidth = width - (2 * safeMargin);
    const sectionWidth = availableWidth / 5;
    
    // 基于帧计数选择一个区域
    let section = frameCount % 5;
    
    // 计算本次掉落的水平位置范围
    let minX = safeMargin + (section * sectionWidth);
    let maxX = safeMargin + ((section + 1) * sectionWidth);
    
    // 在选定区域内随机选择一个位置
    let startX = random(minX, maxX);
    const startY = -100; // 从画布上方开始掉落
    
   // 在创建物体之后，为其添加句子
   let createdBody;
    
   // 创建物体的轮廓的概率，vertice or rectangle
   if (contour && random() < 0.5) {
     createdBody = createContourBody(capturedImage, startX, startY, contour, content, scaleFactorW, scaleFactorH);
   } else {
     createdBody = createRectBody(capturedImage, startX, sizeW, sizeH, content);
   }
   
   // 如果有创建成功的物体，为其分配一个句子
   if (createdBody) {
     addTextToBody(createdBody);
   }
  
  }
