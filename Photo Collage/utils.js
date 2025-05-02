
// Add this function to your code
function debugFingerDetection() {
    if (!hands || hands.length === 0) {
      console.log("No hands detected");
      return;
    }
    
    const hand = hands[0];
    console.log("Hand detected with data:");
    
    if (hand.keypoints) {
      console.log("Keypoints:", hand.keypoints.length);
      // Find all finger tips
      for (let kp of hand.keypoints) {
        if (kp.name && kp.name.includes("_tip")) {
          console.log(`${kp.name}: x=${kp.x}, y=${kp.y}`);
        }
      }
    }
    
    if (hand.keypoints3D) {
      console.log("3D keypoints available");
    }
    
    console.log("Finger position on canvas:", fingerPosition);
    console.log("Finger movement speed:", fingerMovementSpeed);
    console.log("Finger detection status:", fingerDetected);
  }
  
  // Add this function to your code
  function logHandStructure() {
    if (hands && hands.length > 0) {
      const hand = hands[0];
      console.log("----- HAND DATA STRUCTURE -----");
      console.log("Hand keys:", Object.keys(hand));
      
      if (hand.landmarks) {
        console.log("Landmarks available, count:", hand.landmarks.length);
      }
      
      if (hand.annotations) {
        console.log("Annotations available:", Object.keys(hand.annotations));
      }
      
      if (hand.keypoints) {
        console.log("Keypoints available, count:", hand.keypoints.length);
        const fingertips = hand.keypoints.filter(kp => 
          kp.name && kp.name.includes("_tip"));
        console.log("Fingertip keypoints:", fingertips);
      }
      
      console.log("-----------------------------");
    }
  }
  
 
  function keyPressed() {
    if (key === 'f' || key === 'F') {
      let fs = fullscreen();
      fullscreen(!fs);
    }
    
    // 修改为切换调试模式而不是实时检测
    if (key === 'd' || key === 'D') {
      debugMode = !debugMode;
      console.log("调试模式: " + (debugMode ? "开启" : "关闭"));
    }
  
     // Add a key to log hand data
     if (key === 'h' || key === 'H') {
      console.log("Current hands data:", hands);
      if (hands && hands.length > 0) {
        logHandStructure();
      } else {
        console.log("No hands detected currently");
      }
    }
  
  
    // Add this case for index finger debugging
    if (key === 'i' || key === 'I') {
      debugFingerDetection();
    }
  }




function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    
    // Update ground position on resize
    World.clear(world);
    let ground = Bodies.rectangle(width/2, height-2, width * 1.5, 10, { 
      isStatic: true,
      friction: 0.5,     // 保持与setup一致
      restitution: 0.01  // 保持与setup一致
    });
    
    // 调整侧壁位置至屏幕边缘附近
    let leftWall = Bodies.rectangle(10, height/2, 20, height * 2, { isStatic: true });
    let rightWall = Bodies.rectangle(width - 10, height/2, 20, height * 2, { isStatic: true });
    
    World.add(world, [ground, leftWall, rightWall]);
    
    // 重新添加所有现有物体
    for (let body of bodies) {
      
      if (body.isRemoved) continue;
      World.add(world, body.body);
    }
  }
  