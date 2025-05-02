
  
  // 添加创建轮廓物体的函数
  function createContourBody(capturedImage, startX, startY, contour, content, scaleFactorW, scaleFactorH) {
    try {
      // 缩放并移动轮廓点
      const vertices = contour.points.map(p => {
        return {
          x: startX + (p.x * scaleFactorW * 1.1) - (content.width * scaleFactorW / 2),
          y: startY + (p.y * scaleFactorH * 1.1) - (content.height * scaleFactorH / 2)
        };
      });
      
      // 物理属性
      const bodyOptions = {
        friction: 0.5,
        frictionAir: 0.001,
        restitution: 0.01,
        density: 0.0015,
        chamfer: { radius: 2 }, // 轻微倒角
        render: { visible: false }
      };
      
      // 创建物体 - 确保使用单个顶点数组
      const body = Bodies.fromVertices(
        startX, 
        startY, 
        [vertices], 
        bodyOptions
      );
      
      // 如果创建成功
      if (body) {
        // 添加微小的随机初始角度
        Body.setAngle(body, random(-0.05, 0.05));
        
        // 添加随机初始速度
        Body.setVelocity(body, { x: random(-0.2, 0.2), y: 0 });
        
        // 添加至世界
        World.add(world, body);
        
        // 存储对象的代码
      const bodyObj = {
        body: body,
        img: capturedImage,
        sizeW: content.width * scaleFactorW,
        sizeH: content.height * scaleFactorH,
        content: content,
        isContour: true,
        isRemoved: false,
        createdAt: frameCount
      };
      
      // 添加至数组
      bodies.push(bodyObj);
        
        console.log("创建轮廓物体 - 点数: " + vertices.length);
        return bodyObj; // 返回创建的物体对象
      }
    } catch (error) {
      console.error("轮廓物体创建失败:", error);
    }
  
    // 创建失败时，回退到矩形
    return createRectBody(
      capturedImage, 
      startX, 
      content.width * scaleFactorW, 
      content.height * scaleFactorH, 
      content
    );
    
  }
  



function createRectBody(capturedImage, startX, sizeW, sizeH, content) {
    // 使用矩形而非软体网格，矩形更适合堆叠
    const startY = -100; // 从画布上方开始掉落
    
    // 修改物理选项，减少弹性和旋转
    const bodyOptions = {
      friction: 0.5,       // 增加摩擦力（从0.4增加到0.5）
      frictionAir: 0.001,  // 增加空气阻力（从0.0005增加到0.001）
      restitution: 0.01,   // 显著减少弹性（从0.1减小到0.01）
      density: 0.0015,     // 增加密度使其更稳定（从0.001增加到0.0015）
      chamfer: { radius: 4 }, // 保持圆角
      render: { visible: false },
      sleepThreshold: 15
    };
    
    // 创建矩形
    let body = Bodies.rectangle(
      startX, 
      startY, 
      sizeW, 
      sizeH, 
      bodyOptions
    );
    
    // 减小初始旋转角度，防止过度旋转
    Body.setAngle(body, random(-0.05, 0.05)); // 从±0.1减小到±0.05
    
    // 减小随机初始速度
    Body.setVelocity(body, { 
      x: random(-0.2, 0.2), // 从±0.3减小到±0.2
      y: 0
    });
    
    // 添加至世界
    World.add(world, body);
    
    // 存储物体及其图像和属性
    bodies.push({
      body: body,
      img: capturedImage,
      sizeW: sizeW,
      sizeH: sizeH,
      content: content,
      isRemoved: false
    });
    
   
    console.log("创建矩形 - 宽: " + sizeW + ", 高: " + sizeH + ", 比例: " + content.aspect);
  }
  





// 检测画布填充程度
function checkCanvasFillLevel() {
    let totalArea = width * height;
    let occupiedArea = 0;
    let occupiedRegions = Array(10).fill(0); // 将画布分成10个区域
    
    // 计算所有物体占据的大致面积
    for (let body of bodies) {
      if (body.isRemoved) continue;
      
      // 计算这个物体覆盖的面积
      const area = body.sizeW * body.sizeH;
      occupiedArea += area;
      
      // 检查物体在画布中的位置
      const pos = body.body.position;
      const regionIndex = Math.floor((pos.y / height) * 10); // 确定在哪个区域
      if (regionIndex >= 0 && regionIndex < 10) {
        occupiedRegions[regionIndex] += area;
      }
    }
    
    // 计算填充百分比
    const fillPercentage = (occupiedArea / totalArea) * 100;
    
    // 检查是否有区域特别拥挤
    const regionSize = totalArea / 10;
    let crowdedRegions = 0;
    for (let i = 0; i < occupiedRegions.length; i++) {
      if (occupiedRegions[i] / regionSize > 0.8) { // 如果区域填充超过80%
        crowdedRegions++;
      }
    }
    
    // 返回结果
    return {
      fillPercentage: fillPercentage,
      crowdedRegions: crowdedRegions,
      isFull: fillPercentage > 95 || crowdedRegions >= 8 // 自定义"满"的标准
    };
  }





// 添加这个函数来删除最早的图片
function removeOldestHalf() {
    // 获取有效的物体数量
    const validBodies = bodies.filter(body => !body.isRemoved);
    
    // 计算要删除的物体数量
    const removeCount = Math.floor(validBodies.length / 2);
    
    if (removeCount <= 0) return; // 如果没有足够的物体可删，直接返回
    
    console.log(`Canvas too full! Removing ${removeCount} oldest images`);
    
    // 对物体按创建时间排序（我们没有显式存储创建时间，但数组索引代表了创建顺序）
    let bodiesWithIndex = validBodies.map((body, originalIndex) => {
      return { body, originalIndex };
    });
    
    // 按原始索引排序，得到创建时间最早的在前面
    bodiesWithIndex.sort((a, b) => a.originalIndex - b.originalIndex);
    
    // 删除前一半的物体
    for (let i = 0; i < removeCount; i++) {
      const body = bodiesWithIndex[i].body;
      
      // 从物理世界中移除
      World.remove(world, body.body);
      
      // 标记为已移除
      body.isRemoved = true;
      
      // 添加删除效果（可选）
      if (debugMode) {
        // 在调试模式下显示删除痕迹
        const pos = body.body.position;
        push();
        fill(255, 0, 0, 100);
        ellipse(pos.x, pos.y, 40, 40);
        pop();
      }
    }
    
    // 立即清理 bodies 数组，而不是等待定期清理
    bodies = bodies.filter(body => !body.isRemoved);
    1
    console.log(`Removed ${removeCount} images. Remaining: ${bodies.length}`);
  
     // 在移除物体后，同时清理关联的文本
     bodyTexts = bodyTexts.filter(textObj => {
      // 保留未被移除物体的文本
      return !textObj.body.isRemoved;
    });
  
  
  }