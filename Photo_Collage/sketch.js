//https://github.com/ml5js/ml5-library/blob/main/docs/reference/bodypix.md
//

let video;
let bodySegmentation;
let segmentation;
let captureInterval = 5000; // 3 seconds between captures
let lastCaptureTime = 0;
let personPresent = false;
let personAbsentFrames = 0; // Counter for consecutive frames with no person
let clearThreshold = 40; // Number of frames with no person before clearing
let personImage; // Image for the current segmentation

// Matter.js变量
let engine;
let world;
let bodies = []; // 存储物理体的数组

// Matter.js模块别名
const Engine = Matter.Engine;
const Render = Matter.Render;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Composite = Matter.Composite;
const Composites = Matter.Composites;
const Common = Matter.Common;
const Constraint = Matter.Constraint;
const Mouse = Matter.Mouse;

// debugMode 
let debugMode = false; // 调试模式状态变量

// Hand tracking variables 
let handPose;
let hands = [];
let fingerPosition = { x: 0, y: 0 };
let previousFingerPosition = { x: 0, y: 0 };
let fingerMovementSpeed = 0;
let fingerMovementThreshold = 3;
let lastFingerInteractionTime = 0;
let fingerInteractionCooldown = 50;
let fingerDetected = false;

let fingerConstraint = null; // 存储当前活动的食指约束
let constrainedBody = null; // 存储当前被约束的物体


let thumbPosition = { x: 0, y: 0 };
let isPinching = false;
let lastPinchState = false;
let pinchThreshold3D = 40; // pinch threshold for 3D distance
let releaseThreshold = 100; // Automatically release if distance exceeds this
let pinchReleaseSpeed = 30; // Speed at which to release the pinch
let fingerPositionZ = 0;
let thumbPositionZ = 0;

// Text variables
let phrases = [];          // 存储所有句子
let unusedPhrases = [];    // 存储未使用的句子
let bodyTexts = [];        // 存储与图像关联的文本及其显示状态
let usedPhrasesInCurrentCycle = new Set();

let gameFont;


function preload() {
  // Preload the BodyPix model
  bodySegmentation = ml5.bodySegmentation("BodyPix", {
    maskType: "person", //detect entire person as one mask
    outputStride: 16, //Controls the resolution of the internal feature map; lower = higher accuracy, slower speed
    segmentationThreshold: 0.7 //Confidence threshold (0 to 1)
  });

 // 加载字体
 try {
  gameFont = loadFont('fonts/YorkGame-Regular.otf'); // 注意路径
  console.log('字体加载成功');
} catch(e) {
  console.error('字体加载失败:', e);
}

  
  // 加载句子数据
  loadJSON('phrases.json', function(data) {
    phrases = data.phrases;
    // 初始化未使用句子数组并打乱顺序
    resetUnusedPhrases();
  });

}






// 确保地板位置正确
function setup() {
  // Create a canvas that covers the full viewport
  createCanvas(windowWidth, windowHeight);
  
  // Create a video capture - keep original resolution for processing
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide(); // Hide the default HTML element
  
  // Create an image for person segmentation
  personImage = createImage(video.width, video.height);
  
  // Start the continuous detection process
  bodySegmentation.detectStart(video, gotResults);
  
  // Display loading message
  textSize(24);
  textAlign(CENTER, CENTER);
  fill(255);
  text("Loading model...", width/2, height/2);
  
  // Setup Matter.js engine
  engine = Engine.create();
  world = engine.world;
  
  // 适度调整重力
  engine.world.gravity.y = 0.6; // 降低重力，使下落更缓慢
  
  // 地面必须完全水平且更宽，增加摩擦力
  let ground = Bodies.rectangle(width/2, height-2, width * 1.5, 10, { 
    isStatic: true,
    friction: 0.5,     // 增加摩擦力（从0.3增加到0.5）
    restitution: 0.01, // 显著减少弹性（从0.05减小到0.01）
    collisionFilter: {
    category: 0x0001
    }
  });
  
  // 调整侧壁位置至屏幕边缘附近
  let leftWall = Bodies.rectangle(10, height/2, 20, height * 2, { isStatic: true });
  let rightWall = Bodies.rectangle(width - 10, height/2, 20, height * 2, { isStatic: true });
  
  // 将边界添加到世界
  World.add(world, [ground, leftWall, rightWall]);

  // Wait for video to be ready before initializing handpose
  video.elt.onloadeddata = function() {
    console.log("Video ready, starting hand detection");
    
    
    const options = {
      flipHorizontal: true, // mirror the hand detection for natural interaction
      scoreThreshold: 0.7,  // Increase threshold for more stable detections
      detectionConfidence: 0.8, // Only detect confident hands
      maxContinuousChecks: 5, // Limit continuous checks
      iouThreshold: 0.3,
    };
    
    // Initialize handpose
    handPose = ml5.handPose(video, options, function() {
      console.log("HandPose model loaded!");

      handPose.detectStart(video, gotHands);
    });
  };
}





function draw() {

  background(10, 10, 30);

  // Add this console log to debug
  if (frameCount % 60 === 0) {
    console.log("Draw running, frame:", frameCount, "Hands detected:", hands ? hands.length : 0);
  }
  
  // 更新物理引擎
  Engine.update(engine);
  
  // 处理视频显示
  let scaleRatio;
  if (width/height > video.width/video.height) {
    scaleRatio = width / video.width;
  } else {
    scaleRatio = height / video.height;
  }
  
  let scaledWidth = video.width * scaleRatio;
  let scaledHeight = video.height * scaleRatio;
  let vidX = (width - scaledWidth) / 2;
  let vidY = (height - scaledHeight) / 2;
  
  // 绘制视频
  push();
  translate(width, 0); 
  scale(-1, 1);
  image(video, vidX, vidY, scaledWidth, scaledHeight);
  pop();
  
  // 处理手指交互
  if (handPose) {
    processFingerInteraction();
  }
  
  // 循环处理所有物体
  for (let i = 0; i < bodies.length; i++) {
    let body = bodies[i];
    if (body.isRemoved) continue;
    
    let physicsBody = body.body;
    let pos = physicsBody.position;
    let angle = physicsBody.angle;
    
    // 绘制图像
    push();
    translate(pos.x, pos.y);
    rotate(angle);
    scale(-1, 1);
    
    if (body.content && !body.content.isEmpty) {
      image(
        body.img, 
        -body.sizeW/2, -body.sizeH/2, 
        body.sizeW, body.sizeH,
        body.content.x, body.content.y, 
        body.content.width, body.content.height
      );
    } else {
      image(body.img, -body.sizeW/2, -body.sizeH/2, body.sizeW, body.sizeH);
    }
    pop();
    
    // 调试绘制
    if (debugMode) {
      push();
      translate(pos.x, pos.y);
      rotate(angle);
      
      if (body.isContour) {
        stroke(0, 255, 0);
        strokeWeight(2);
        noFill();
        beginShape();
        
        for (let v of physicsBody.vertices) {
          let vx = v.x - pos.x;
          let vy = v.y - pos.y;
          vertex(vx, vy);
        }
        endShape(CLOSE);
      } else {
        stroke(255, 0, 0);
        strokeWeight(2);
        noFill();
        rectMode(CENTER);
        rect(0, 0, body.sizeW, body.sizeH);
      }
      
      noStroke();
      fill(255);
      textSize(8);
      text("W: " + Math.round(body.sizeW) + " H: " + Math.round(body.sizeH), 0, 0);
      pop();
    }
    
    // 校正位置，防止物体掉到地面以下
    if (pos.y + body.sizeH/2 > height - 2) {
      let correctedY = height - 2 - body.sizeH/2;
      Body.setPosition(physicsBody, { x: pos.x, y: correctedY });
      
      Body.setVelocity(physicsBody, { 
        x: physicsBody.velocity.x * 0.9,
        y: 0 
      });
    }
    
    // 检查物体是否离开画布
    if (body.canLeaveCanvas) {

      // 新的移除条件：碰到上边缘
  const isTouchingTopEdge = pos.y - body.sizeH/2 <= 0;
  
  // 增加判断，确保这不是新生成的物体（通过检查它的出现时间）
  const isNewlyCreated = frameCount - body.markedForRemovalFrame < 30;
  
  // 只有当物体不是新生成的，并且触碰到上边缘时才移除
  if (isTouchingTopEdge && !isNewlyCreated) {
    World.remove(world, physicsBody);
    body.isRemoved = true;
  }


      //超过一段距离才remove
      // const isWayOffScreen = 
      //   pos.x < -body.sizeW*2 || 
      //   pos.x > width + body.sizeW*2 || 
      //   pos.y < -body.sizeH*2 || 
      //   pos.y > height + body.sizeH*2;
        
      // if (isWayOffScreen && frameCount - body.markedForRemovalFrame > 60) {
      //   World.remove(world, physicsBody);
      //   body.isRemoved = true;
      // }
    } else {
      // 保持物体在边界内
      if (pos.x < body.sizeW/2) {
        Body.setPosition(physicsBody, { x: body.sizeW/2, y: pos.y });
        Body.setVelocity(physicsBody, { x: 0, y: physicsBody.velocity.y });
      }
      if (pos.x > width - body.sizeW/2) {
        Body.setPosition(physicsBody, { x: width - body.sizeW/2, y: pos.y });
        Body.setVelocity(physicsBody, { x: 0, y: physicsBody.velocity.y });
      }
    }
  } // 结束 for 循环
  
  // 定期清理 bodies 数组
  if (frameCount % 30 === 0) {
    bodies = bodies.filter(body => !body.isRemoved);
  }
  
  // 显示状态信息
  fill(255);
  textSize(16);
  textAlign(LEFT, BOTTOM);
  text("Person detected: " + (personPresent ? "Yes" : "No"), 20, height - 40);
  text("Bodies: " + bodies.filter(b => !b.isRemoved).length, 20, height - 20);
  
  // 显示说明
  fill(255, 128, 0);

  if (typeof gameFont !== 'undefined' && gameFont) {
    textFont(gameFont);
  }

  textSize(18);
  textAlign(CENTER);
  text("Body segments are captured every 5 seconds", width/2, 30);
  text("Pinch and drag images to the top to remove them", width/2, 60);
  text("Move your index finger to interact with objects", width/2, 90);
  
  // 显示调试状态
  if (debugMode) {
    push();
  textFont('Arial');
  fill(255, 0, 0);
  textSize(16);
  textAlign(LEFT, TOP);
  text("DEBUG MODE", 10, 10);
  
  // 添加调试信息 - 帧率
  text("FPS: " + Math.round(frameRate()), 10, 30);
  
  // 替换X和Y坐标为简单的检测状态
  if (fingerDetected) {
    fill(0, 255, 0); // 绿色表示检测到
    text("Finger detected", 10, 50);
    
    // 仍然显示速度信息
    fill(255);
    text("Finger speed: " + Math.round(fingerMovementSpeed), 10, 70);
    fill(fingerMovementSpeed > fingerMovementThreshold ? color(0, 255, 0) : color(255, 0, 0));
    ellipse(200, 65, 10, 10); // 调整指示器位置以匹配新的文本位置
  } else {
    fill(255, 0, 0); // 红色表示未检测到
    text("No finger detected", 10, 50);
  }
  
  // 添加约束信息
  fill(255);
  text("Constraint: " + (fingerConstraint ? "Active" : "None"), 10, 90); 
  // 添加更多调试信息
  if (fingerConstraint && constrainedBody) {
    const vel = constrainedBody.velocity;
    const bodySpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    // text("Object speed: " + Math.round(bodySpeed), 10, 150); 
    
    // 添加约束线可视化
    stroke(255, 255, 0);
    strokeWeight(2);
    line(
      fingerPosition.x, 
      fingerPosition.y, 
      constrainedBody.position.x, 
      constrainedBody.position.y
    );
  }
  noStroke();
  fill(255);
   // 添加捏合状态信息
   text("Pinch state: " + (isPinching ? "Pinching" : "Open"), 10, 110);
  
  
   
   // 如果正在捏合并有约束，绘制到捏合中心的线
   if (isPinching && fingerConstraint) {
     stroke(255, 255, 0);
     strokeWeight(3);
     const pinchCenter = {
       x: (fingerPosition.x + thumbPosition.x) / 2,
       y: (fingerPosition.y + thumbPosition.y) / 2
     };
     line(
       pinchCenter.x,
       pinchCenter.y,
       constrainedBody.position.x,
       constrainedBody.position.y
     );
   }

  
  pop();
  }

  
const fillStatus = checkCanvasFillLevel();

// 显示填充状态
if (debugMode) {
  textFont('Arial');
  textAlign(LEFT, TOP);
  fill(255, 255, 0);
  textSize(16);

  text("Canvas fill: " + Math.round(fillStatus.fillPercentage) + "%", 10, 150);
  text("Crowded regions: " + fillStatus.crowdedRegions + "/10", 10, 170);
  
 // 修改当画布满时的处理逻辑
if (fillStatus.isFull) {
  
  // 立即清理旧图片，而不是等待特定帧数
  removeOldestHalf();
}
}

renderBodyTexts();

} // 结束 draw() 函数




