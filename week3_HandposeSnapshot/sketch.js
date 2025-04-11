let video;
let faceapi;
let handpose;
let detections = [];
let predictions = [];
let lastGesture = null;//“空值”目前还没有识别到任何手势
let gestureTimeout = null;
let debugMode = true; // 调试模式

// 设置一个置信度阈值，避免误识别
let confidenceThreshold = 0.8;

let snapshots = []; // 存放 {img, x, y, label}
let phrases = []; // 将从JSON文件加载

let showInstructions = true; // 控制是否显示指导提示

function preload() {
  // 在setup之前加载JSON文件
  loadJSON('phrases.json', data => {
    phrases = data.phrases;
    console.log("成功加载了" + phrases.length + "条短语");
  });
}

function setup() {
  // 创建铺满窗口的画布
  createCanvas(windowWidth, windowHeight);
  
  // 创建视频元素 - 使用更小的分辨率以提高性能
  video = createCapture(VIDEO);
  // 不必要改变视频尺寸，保持默认分辨率提高性能
  video.hide();

  const faceOptions = {
    withLandmarks: true,
    withDescriptors: false,
  };
  faceapi = ml5.faceApi(video, faceOptions, faceModelReady);
  
  // 添加 handpose 模型，并设置为同样的水平翻转
  handpose = ml5.handpose(video, {
    flipHorizontal: true // 让模型处理翻转，这样数据就可以直接与我们显示匹配
  }, handposeModelReady);
  
  // 设置 handpose 事件监听
  handpose.on('predict', results => {
    // 只接受置信度高的检测结果
    predictions = results.filter(hand => hand.handInViewConfidence > confidenceThreshold);
  });
  
  textFont('sans-serif');
}

// 窗口大小变化时重设画布大小
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function faceModelReady() {
  console.log("FaceAPI model ready!");
  faceapi.detect(gotFaces);
}

function handposeModelReady() {
  console.log("Handpose model ready!");
}

function gotFaces(err, result) {
  if (err) {
    console.error(err);
    return;
  }
  detections = result;
  faceapi.detect(gotFaces); // 循环检测
}

function draw() {
  background(0);
  
  // 计算视频在窗口中的合适尺寸 - 铺满窗口
  let vidW, vidH;
  let videoRatio = video.width / video.height;
  let windowRatio = windowWidth / windowHeight;
  
  // 计算视频应该填满窗口的尺寸
  if (windowRatio > videoRatio) {
    // 窗口较宽，视频宽度与窗口匹配
    vidW = windowWidth;
    vidH = vidW / videoRatio;
  } else {
    // 窗口较高，视频高度与窗口匹配
    vidH = windowHeight;
    vidW = vidH * videoRatio;
  }
  
  // 居中显示视频
  let xOffset = (windowWidth - vidW) / 2;
  let yOffset = (windowHeight - vidH) / 2;
  
  // 绘制镜像视频
  push();
  translate(windowWidth, 0);
  scale(-1, 1);
  image(video, xOffset, yOffset, vidW, vidH);
  pop();

  // 检测手势
  checkGestures();

  // 画当前脸部框 - 需要处理镜像和缩放
  if (detections && detections.length > 0) {
    let {_x, _y, _width, _height} = detections[0].alignedRect._box;
    
    // 计算缩放比例
    let scaleX = vidW / video.width;
    let scaleY = vidH / video.height;
    
    // 镜像和缩放调整
    let mirrorX = windowWidth - (_x * scaleX + xOffset) - (_width * scaleX);
    
    //画出脸部框
    // noFill();
    // stroke(0, 255, 0);
    // strokeWeight(2);
    // rect(mirrorX, _y * scaleY + yOffset, _width * scaleX, _height * scaleY);
  }

  // 显示所有 snapshot
  for (let s of snapshots) {
    image(s.img, s.x, s.y, 100, 100); // 显示小图
    noStroke();
    fill(255);
    textSize(12);
    textAlign(CENTER);
    text(s.label, s.x + 50, s.y + 110);
  }
  
  // 显示当前手势状态
  fill(255);
  textSize(16);
  textAlign(LEFT);
  text("Current Gesture: " + (lastGesture || "None"), 10, 30);
  
  // 显示手部识别状态
  text("Hand Detection: " + (predictions.length > 0 ? "Detected" : "Not Detected"), 10, 50);
  
  // 调试视觉反馈
  if (debugMode && predictions.length > 0) {
    const hand = predictions[0];
    
    // 显示手部置信度
    text("Hand Confidence: " + nf(hand.handInViewConfidence, 1, 2), 10, 70);
    
    const { highestFinger, allFingers } = analyzeHand(hand.annotations);
    text("Number of Detected Fingers: " + allFingers, 10, 90);
    
    // 计算缩放比例
    let scaleX = vidW / video.width;
    let scaleY = vidH / video.height;
    
    // 显示所有手指关节点
    drawHandLandmarks(hand, xOffset, yOffset, scaleX, scaleY);
    
    // 如果有最高的手指，在指尖位置显示绿色圆点
    if (highestFinger) {
      const fingerTip = hand.annotations[highestFinger][3];
      
      // 应用缩放和偏移
      const tipX = fingerTip[0] * scaleX + xOffset;
      const tipY = fingerTip[1] * scaleY + yOffset;
      
      fill(0, 255, 0);
      ellipse(tipX, tipY, 15, 15);
      text("Fingertip Position", tipX + 20, tipY);
      text("Current Fingertip: " + highestFinger, 10, 110);
    }
  }

  // 在检测手势和显示快照之后，添加指导性提示
  if (showInstructions) {
    // 创建半透明背景，提高文本可读性
    fill(0, 0, 0, 180); // 半透明黑色背景
    noStroke();
    rectMode(CENTER);
    rect(windowWidth/2, windowHeight - 50, windowWidth, 80, 10); // 在底部创建圆角矩形
    
    // 在屏幕底部居中显示提示文本
    fill(255, 255, 200); // 淡黄色文字更醒目
    textSize(18);
    textAlign(CENTER);
    text("Point with one finger to capture images, open all five fingers to clear all images", 
         windowWidth/2, windowHeight - 60);
    
    textSize(14);
    text("Keep gesture stable for 1 second to confirm action", 
         windowWidth/2, windowHeight - 30);
  }
}

// function drawHandLandmarks(hand, xOffset, yOffset, scaleX, scaleY) {
//   // 画出所有指关节点，方便调试
//   const fingers = ["thumb", "indexFinger", "middleFinger", "ringFinger", "pinky"];
  
//   for (let finger of fingers) {
//     for (let i = 0; i < hand.annotations[finger].length; i++) {
//       const point = hand.annotations[finger][i];
      
//       // 应用缩放和偏移
//       const x = point[0] * scaleX + xOffset; 
//       const y = point[1] * scaleY + yOffset;
      
//       // 根据指节类型使用不同颜色
//       if (i === 3) { // 指尖
//         fill(0, 255, 0); 
//         ellipse(x, y, 8, 8);
//       } else {
//         fill(255, 0, 0);
//         ellipse(x, y, 5, 5);
//       }
//     }
//   }
  
//   // 画出手掌基点
//   for (let point of hand.annotations.palmBase) {
//     const x = point[0] * scaleX + xOffset;
//     const y = point[1] * scaleY + yOffset;
//     fill(0, 0, 255);
//     ellipse(x, y, 5, 5);
//   }
// }

// 修改后的drawHandLandmarks函数，只显示最高指尖
function drawHandLandmarks(hand, xOffset, yOffset, scaleX, scaleY) {
  // 首先分析手，找出最高的手指
  const { highestFinger } = analyzeHand(hand.annotations);
  
  // 如果找到了最高的手指，只绘制它的指尖
  if (highestFinger) {
    const fingerTip = hand.annotations[highestFinger][3]; // 指尖
    
    // 应用缩放和偏移
    const x = fingerTip[0] * scaleX + xOffset; 
    const y = fingerTip[1] * scaleY + yOffset;
    
    // 绘制绿色指尖标记
    // fill(0, 255, 0); 
    // ellipse(x, y, 15, 15);
    
    // 可选：添加一个小标签
    // textAlign(LEFT);
    // textSize(14);
    // text(highestFinger, x + 15, y);
  }
  
  // 其他所有关节点不再显示
}

function analyzeHand(annotations) {
  // 分析手的状态，返回最高的手指和总的手指数量
  const palmBase = annotations.palmBase[0];
  let highestFinger = null;
  let highestY = palmBase[1]; // 初始值为手掌基部的Y坐标
  let extendedFingers = 0;
  
  // 检查大拇指
  const thumbTip = annotations.thumb[3]; // 拇指尖
  const thumbBase = annotations.thumb[0]; // 拇指根部
  if (dist(thumbTip[0], thumbTip[1], thumbBase[0], thumbBase[1]) > 50) {
    extendedFingers++;
    // 通常不会把大拇指作为"最高的手指"，因为它在侧面
  }
  
  // 检查其他四个手指
  const fingerNames = ["indexFinger", "middleFinger", "ringFinger", "pinky"];
  for (let finger of fingerNames) {
    const fingerTip = annotations[finger][3]; // 指尖
    const fingerBase = annotations[finger][0]; // 指根
    
    // 检查手指是否伸直（指尖比指根高出足够距离）
    if (fingerTip[1] < fingerBase[1] - 25) { // y坐标更小表示更高
      extendedFingers++;
      
      // 检查是否是目前为止最高的手指
      if (fingerTip[1] < highestY) {
        highestY = fingerTip[1];
        highestFinger = finger;
      }
    }
  }
  
  return {
    highestFinger: highestFinger,
    allFingers: extendedFingers
  };
}

function checkGestures() {
  if (predictions.length === 0) return;
  
  const hand = predictions[0];
  const { highestFinger, allFingers } = analyzeHand(hand.annotations);
  
  // 计算视频在窗口中的缩放比例和偏移
  let videoRatio = video.width / video.height;
  let windowRatio = windowWidth / windowHeight;
  let vidW, vidH, xOffset, yOffset;
  
  if (windowRatio > videoRatio) {
    vidW = windowWidth;
    vidH = vidW / videoRatio;
    xOffset = 0;
    yOffset = (windowHeight - vidH) / 2;
  } else {
    vidH = windowHeight;
    vidW = vidH * videoRatio;
    xOffset = (windowWidth - vidW) / 2;
    yOffset = 0;
  }
  
  let scaleX = vidW / video.width;
  let scaleY = vidH / video.height;
  
  // 只用一根手指指向（存在最高的手指，但是总数小于3）
  if (highestFinger && allFingers < 3 && lastGesture !== "pointing") {
    lastGesture = "pointing";
    console.log("检测到指向手势，使用" + highestFinger);
    
    // 获取指尖的位置
    const fingerTip = hand.annotations[highestFinger][3];
    
    // 应用缩放和偏移
    const tipX = fingerTip[0] * scaleX + xOffset;
    const tipY = fingerTip[1] * scaleY + yOffset;
    
    captureSnapshot(tipX, tipY);
    
    // 当有新快照时，显示指导提示
    showInstructions = true;
    
    // 防止连续触发
    clearTimeout(gestureTimeout);
    gestureTimeout = setTimeout(() => {
      lastGesture = null;
    }, 1000);
  } 
  // 只有检测到5个手指时才触发清除
  else if (allFingers === 5 && lastGesture !== "open_hand" && lastGesture !== "open_hand_confirm") {
    // 第一次检测到张开手掌
    lastGesture = "open_hand_confirm";
    console.log("检测到五指张开，请保持1秒确认清除");
    
    // 设置确认计时器
    clearTimeout(gestureTimeout);
    gestureTimeout = setTimeout(() => {
      // 如果1秒后仍然是确认状态，则执行清除
      if (lastGesture === "open_hand_confirm") {
        console.log("确认清除所有快照");
        snapshots = []; // 清空
        
        // 清除所有快照后隐藏指导提示
        showInstructions = false;
        
        lastGesture = "open_hand";
        
        // 重置手势
        setTimeout(() => {
          lastGesture = null;
        }, 1000);
      }
    }, 1000);
  }
  // 拳头状态（没有检测到伸出的手指）
  else if (allFingers === 0 && lastGesture !== "fist") {
    lastGesture = "fist";
    console.log("检测到握拳手势");
    
    // 拳头状态不做任何操作
    
    clearTimeout(gestureTimeout);
    gestureTimeout = setTimeout(() => {
      lastGesture = null;
    }, 1000);
  }
  // 其他手势或者张开手掌被中断
  else if (allFingers < 5 && lastGesture === "open_hand_confirm") {
    console.log("张开手掌确认被取消");
    lastGesture = "other";
    
    clearTimeout(gestureTimeout);
    gestureTimeout = setTimeout(() => {
      lastGesture = null;
    }, 500);
  }
}

function captureSnapshot(x, y) {
  if (detections.length > 0) {
    let { _x, _y, _width, _height } = detections[0].alignedRect._box;

    // 计算视频在窗口中的缩放比例和偏移
    let videoRatio = video.width / video.height;
    let windowRatio = windowWidth / windowHeight;
    let vidW, vidH, xOffset, yOffset;
    
    if (windowRatio > videoRatio) {
      vidW = windowWidth;
      vidH = vidW / videoRatio;
      xOffset = 0;
      yOffset = (windowHeight - vidH) / 2;
    } else {
      vidH = windowHeight;
      vidW = vidH * videoRatio;
      xOffset = (windowWidth - vidW) / 2;
      yOffset = 0;
    }
    
    let scaleX = vidW / video.width;
    let scaleY = vidH / video.height;
    
    // 在镜像模式下调整X坐标
    let mirrorX = windowWidth - (_x * scaleX + xOffset) - (_width * scaleX);

    // 获取正确的脸部区域（从原始视频而不是缩放后的视频）
    let faceImg = video.get(_x, _y, _width, _height);
    
    // 镜像翻转获取的人脸图像
    let mirroredFace = createImage(_width, _height);
    mirroredFace.copy(faceImg, 0, 0, _width, _height, 0, 0, _width, _height);
    mirroredFace.loadPixels();
    
    // 手动翻转图像
    for (let y = 0; y < _height; y++) {
      for (let x = 0; x < _width/2; x++) {
        let index1 = 4 * (y * _width + x);
        let index2 = 4 * (y * _width + (_width-1-x));
        
        // 交换像素
        for (let i = 0; i < 4; i++) {
          let temp = mirroredFace.pixels[index1+i];
          mirroredFace.pixels[index1+i] = mirroredFace.pixels[index2+i];
          mirroredFace.pixels[index2+i] = temp;
        }
      }
    }
    mirroredFace.updatePixels();
    
    let label = random(phrases);
    
    // 使用指尖位置而不是手掌位置，确保不超出窗口边界
    let snapX = constrain(x - 30, 0, windowWidth - 60); 
    let snapY = constrain(y - 30, 0, windowHeight - 80);
    
    snapshots.push({
      img: mirroredFace,
      x: snapX,
      y: snapY,
      label: label
    });
    
    // 有快照时显示提示
    showInstructions = true;
  }
}

// 保留键盘控制作为备选
function keyPressed() {
  if (key === 's' && detections.length > 0) {
    captureSnapshot(random(windowWidth - 60), random(windowHeight - 80));
  }

  if (key === 'c') {
    snapshots = []; // 清空
    showInstructions = false; // 清空后隐藏提示
  }
  
  // 切换调试模式
  if (key === 'd') {
    debugMode = !debugMode;
  }
}
