// Function to receive hand predictions
function gotHands(results) {
    hands = results;
    
    // Debug periodically
    if (frameCount % 300 === 0) {
      console.log("Hands detected:", hands.length);
      if (hands.length > 0) {
        console.log("Hand sample structure:", Object.keys(hands[0]));
      }
    }
  }
  
  
function processFingerInteraction() {
    // 保存上一帧的状态
    const wasFingerDetected = fingerDetected;
    const wasPinching = isPinching;
    
    // 重置当前状态
    fingerDetected = false;
    isPinching = false;
    
    // 如果没有检测到手
    if (!hands || hands.length === 0) {
      if (wasFingerDetected && fingerConstraint) {
        releaseFingerConstraint();
      }
      return;
    }
    
    try {
      // 获取第一个检测到的手
      const hand = hands[0];
      let indexFingerPos = null;
      let thumbPos = null;
      
      // 获取食指位置
      if (hand.keypoints) {
        for (let keypoint of hand.keypoints) {
          if (keypoint.name === "index_finger_tip") {
            indexFingerPos = [keypoint.x, keypoint.y];
          }
          if (keypoint.name === "thumb_tip") {
            thumbPos = [keypoint.x, keypoint.y];
          }
        }
      }
      
      // 尝试 keypoints3D (如果上面失败)
      if ((!indexFingerPos || !thumbPos) && hand.keypoints3D) {
        for (let keypoint of hand.keypoints3D) {
          if (keypoint.name === "index_finger_tip" && !indexFingerPos) {
            indexFingerPos = [
              keypoint.x * video.width,
              keypoint.y * video.height
            ];
            // 这里可以添加Z坐标获取
        indexFingerZ = keypoint.z;
          }
          if (keypoint.name === "thumb_tip" && !thumbPos) {
            thumbPos = [
              keypoint.x * video.width,
              keypoint.y * video.height
            ];
          }
        }
      }
      
      // 最后尝试 annotations
      if (!indexFingerPos && hand.annotations && hand.annotations.indexFinger) {
        indexFingerPos = hand.annotations.indexFinger[3];
      }
      
      if (!thumbPos && hand.annotations && hand.annotations.thumb) {
        thumbPos = hand.annotations.thumb[3];
      }
      
      // 处理食指位置
      if (indexFingerPos) {
        fingerDetected = true;
        
        // 转换为画布坐标
        const fingerX = map(indexFingerPos[0], 0, video.width, 0, width);
        const fingerY = map(indexFingerPos[1], 0, video.height, 0, height);
        
        // 保存上一帧位置
        previousFingerPosition.x = fingerPosition.x;
        previousFingerPosition.y = fingerPosition.y;
        
        // 更新当前位置
        fingerPosition.x = fingerX;
        fingerPosition.y = fingerY;
  
         // 如果有Z轴信息，也保存下来
    if (hand.keypoints3D) {
      for (let kp of hand.keypoints3D) {
        if (kp.name === "index_finger_tip") {
          fingerPositionZ = kp.z;
          break;
        }
      }
    }
        
        // 计算速度
        const dx = fingerPosition.x - previousFingerPosition.x;
        const dy = fingerPosition.y - previousFingerPosition.y;
        fingerMovementSpeed = Math.sqrt(dx * dx + dy * dy);
        
        // 绘制食指指示器
        push();
        noStroke();
        // stroke(0);
        // strokeWeight(3);
        fill(0, 255, 0);
        ellipse(fingerPosition.x, fingerPosition.y, 30, 30);
        pop();
      }
      
      // 处理拇指位置
      if (thumbPos) {
        // 转换为画布坐标
        const thumbX = map(thumbPos[0], 0, video.width, 0, width);
        const thumbY = map(thumbPos[1], 0, video.height, 0, height);
        
        // 更新拇指位置
        thumbPosition.x = thumbX;
        thumbPosition.y = thumbY;
  
        // 获取拇指Z轴信息
    if (hand.keypoints3D) {
      for (let kp of hand.keypoints3D) {
        if (kp.name === "thumb_tip") {
          thumbPositionZ = kp.z;
          break;
        }
      }
    }
        
        // 绘制拇指指示器
        push();
        noStroke();
        // stroke(0);
        // strokeWeight(3);
        fill(0, 200, 255); // 蓝色表示拇指
        ellipse(thumbPosition.x, thumbPosition.y, 30, 30);
        pop();
        
        // 检测捏合状态，考虑Z轴
    if (fingerDetected) {
      // 2D距离 - 用于显示线
      const pinchDistance2D = dist(fingerPosition.x, fingerPosition.y, 
                                thumbPosition.x, thumbPosition.y);
      
      // 3D距离计算 - 用于判断捏合
      const zFactor = 500; // Z轴缩放因子，因为Z值通常很小
      const pinchDistance3D = Math.sqrt(
        Math.pow(fingerPosition.x - thumbPosition.x, 2) +
        Math.pow(fingerPosition.y - thumbPosition.y, 2) +
        Math.pow((fingerPositionZ - thumbPositionZ) * zFactor, 2)
      );
      
      // 使用3D距离判断捏合
      isPinching = pinchDistance3D < pinchThreshold3D;
      
      // 在调试模式下显示两个距离
      if (debugMode && pinchDistance2D < 80) {
        push();
        stroke(isPinching ? color(255, 255, 0) : color(150, 150, 150));
        strokeWeight(isPinching ? 4 : 2);
        line(fingerPosition.x, fingerPosition.y, thumbPosition.x, thumbPosition.y);
        
        fill(255);
        noStroke();
        // text("2D: " + Math.round(pinchDistance2D), 
        //     (fingerPosition.x + thumbPosition.x)/2 - 20, 
        //     (fingerPosition.y + thumbPosition.y)/2);
        text("3D: " + Math.round(pinchDistance3D), 
            (fingerPosition.x + thumbPosition.x)/2 - 20, 
            (fingerPosition.y + thumbPosition.y)/2 + 15);
  
            // text("Z distance: " + Math.abs(fingerPositionZ - thumbPositionZ).toFixed(4), 10, 170);
            // text("Raw Z values - Index: " + fingerPositionZ.toFixed(4) + ", Thumb: " + thumbPositionZ.toFixed(4), 10, 190);
        pop();
      }
    }
      }
      
      // 处理约束状态变化
      handleConstraintChanges(wasPinching);
      
      // 自动检测释放条件
      checkAutoRelease();
      
    } catch (error) {
      console.error("Error in finger interaction:", error);
    }
  }



// 检查是否应该自动释放约束
function checkAutoRelease() {
    if (fingerConstraint && constrainedBody) {
      // 计算手指到约束物体的距离
      const distX = fingerPosition.x - constrainedBody.position.x;
      const distY = fingerPosition.y - constrainedBody.position.y;
      const distance = Math.sqrt(distX * distX + distY * distY);
      
      // 如果是捏合状态，使用较大距离；否则使用较小距离
      const threshold = isPinching ? releaseThreshold * 1.5 : releaseThreshold;
      
      // 如果距离超过阈值，自动释放
      if (distance > threshold) {
        releaseFingerConstraint();
      }
    }
  }
  



  function handleConstraintChanges(wasPinching) {
    if (isPinching) {
      // 任何捏合状态下的处理
      if (!wasPinching) {
        // 刚开始捏合 - 尝试抓取物体
        if (fingerConstraint) {
          releaseFingerConstraint();
        }
        grabObjectWithPinch();
      } else if (fingerConstraint) {
        // 持续捏合中 - 更新约束位置为捏合中点
        updatePinchConstraint();
      }
    } else {
      // 非捏合状态下的处理
      if (wasPinching && fingerConstraint) {
        // 刚结束捏合 - 释放可能的抛出
        releaseWithPossibleThrow();
      } else {
        // 单指交互 - 移除速度过滤条件
        handleFingerInteraction();
      }
    }
  }
  


  
// 捏合抓取物体
function grabObjectWithPinch() {
    const pinchPosition = {
      x: (fingerPosition.x + thumbPosition.x) / 2,
      y: (fingerPosition.y + thumbPosition.y) / 2
    };
    
    // 找到最近的物体
    let closestBody = null;
    let minDistance = 50; // 抓取半径
    
    for (let body of bodies) {
      if (body.isRemoved) continue;
      
      const physicsBody = body.body;
      const pos = physicsBody.position;
      
      // 计算距离
      const distX = pos.x - pinchPosition.x;
      const distY = pos.y - pinchPosition.y;
      const distance = Math.sqrt(distX * distX + distY * distY);
      
      // 选择最近的物体
      if (distance < minDistance + (body.sizeW + body.sizeH)/4) {
        closestBody = physicsBody;
        minDistance = distance;
      }
    }
    
    // 如果找到物体，创建强力约束
    if (closestBody) {
      // 标记可以离开画布
      for (let body of bodies) {
        if (body.body === closestBody) {
          body.canLeaveCanvas = true;
          body.markedForRemovalFrame = frameCount;
          break;
        }
      }
      
      // 创建约束 - 比单指交互更强
      constrainedBody = closestBody;
      fingerConstraint = Constraint.create({
        pointA: pinchPosition,
        bodyB: constrainedBody,
        pointB: { x: 0, y: 0 },
        stiffness: 0.7,  // 强力抓取
        damping: 0.3,    // 减少阻尼以便于抛出
        length: 0,
        render: {
          visible: debugMode,
          lineWidth: 3,
          strokeStyle: '#ffcc00'
        }
      });
      
      Composite.add(world, fingerConstraint);
    }
  }
  
  




// 释放物体，可能带有抛出效果
function releaseWithPossibleThrow() {
    if (fingerConstraint && constrainedBody) {
      // 计算当前速度
      const dx = fingerPosition.x - previousFingerPosition.x;
      const dy = fingerPosition.y - previousFingerPosition.y;
      const currentSpeed = Math.sqrt(dx * dx + dy * dy);
      
      // 如果速度足够大，应用抛出力
      if (currentSpeed > pinchReleaseSpeed) {
        // 计算抛出方向和力量
         // 使用更小的系数计算力
         const forceMultiplier = 0.002; // 更小的力度系数
         const force = {
           x: dx * forceMultiplier * constrainedBody.mass,
           y: dy * forceMultiplier * constrainedBody.mass
        };
  
  
        // 添加物体速度上限，防止过快
        const maxVelocity = 25; // 设置最大速度限制
        const velocity = constrainedBody.velocity;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        
        if (speed > maxVelocity) {
          const scaleFactor = maxVelocity / speed;
          Body.setVelocity(constrainedBody, {
            x: velocity.x * scaleFactor,
            y: velocity.y * scaleFactor
          });
        }
  
  
        
        // 应用力
        Body.applyForce(constrainedBody, 
          constrainedBody.position, 
          force
        );
      }
      
      // 移除约束
      releaseFingerConstraint();
    }
  }


// 更新捏合约束位置
function updatePinchConstraint() {
    if (fingerConstraint) {
      // 移除旧约束
      Composite.remove(world, fingerConstraint);
      
      // 计算捏合中点
      const pinchPosition = {
        x: (fingerPosition.x + thumbPosition.x) / 2,
        y: (fingerPosition.y + thumbPosition.y) / 2
      };
      
      // 创建新约束
      fingerConstraint = Constraint.create({
        pointA: pinchPosition,
        bodyB: constrainedBody,
        pointB: { x: 0, y: 0 },
        stiffness: 0.7,  // 强力抓取
        damping: 0.3,    // 减少阻尼以便于抛出
        length: 0,
        render: {
          visible: debugMode,
          lineWidth: 3,
          strokeStyle: '#ffcc00'
        }
      });
      
      Composite.add(world, fingerConstraint);
    }
  }

  

// 食指交互函数 - 更轻松的交互方式
function handleFingerInteraction() {
    // 如果已经有约束并且不是捏合状态，更新位置
    if (fingerConstraint && !isPinching) {
      updateFingerConstraint();
      return;
    }
    
   // 移除速度限制条件，只保留极端值过滤
   if (fingerMovementSpeed > 20) { // 只过滤非常快的移动
    return;
  }
    
    const touchRadius = 40; // 稍微减小检测半径
    
    // 查找距离手指最近的物体
    let closestBody = null;
    let minDistance = touchRadius;
    
    for (let body of bodies) {
      if (body.isRemoved) continue;
      
      const physicsBody = body.body;
      const pos = physicsBody.position;
      
      // 计算到手指的距离
      const distX = pos.x - fingerPosition.x;
      const distY = pos.y - fingerPosition.y;
      const distance = Math.sqrt(distX * distX + distY * distY);
      
      // 选择最近的物体
      if (distance < minDistance + (body.sizeW + body.sizeH)/5) { // 减少影响区域
        closestBody = physicsBody;
        minDistance = distance;
      }
    }
    
    // 如果找到物体，创建轻度约束
    if (closestBody) {
      // 标记物体
      for (let body of bodies) {
        if (body.body === closestBody) {
          body.canLeaveCanvas = true;
          body.markedForRemovalFrame = frameCount;
          break;
        }
      }
      
      // 创建约束 - 轻微的，像鼠标一样
      constrainedBody = closestBody;
      fingerConstraint = Constraint.create({
        pointA: { x: fingerPosition.x, y: fingerPosition.y },
        bodyB: constrainedBody,
        pointB: { x: 0, y: 0 },
        stiffness: 0.15,  // 非常松软的弹性感
        damping: 0.4,    // 较强的阻尼
        length: 0,       // 增加一点长度，让感觉更松散
        render: {
          visible: debugMode,
          lineWidth: 2,
          strokeStyle: '#ffff00'
        }
      });
      
      Composite.add(world, fingerConstraint);
    }
  }
  


function interactWithBodies(dx, dy, speed) {
    handleFingerConstraint();
  }


  // 添加新函数来释放约束
function releaseFingerConstraint() {
    if (fingerConstraint) {
      // 移除约束
      Composite.remove(world, fingerConstraint);
      fingerConstraint = null;
      constrainedBody = null;
    }
  }
  
 
  function updateFingerConstraint() {
    if (fingerConstraint) {
      // 移除旧约束
      Composite.remove(world, fingerConstraint);
      
      // 创建新约束，保持相同特性
      fingerConstraint = Constraint.create({
        pointA: { x: fingerPosition.x, y: fingerPosition.y },
        bodyB: constrainedBody,
        pointB: { x: 0, y: 0 },
        stiffness: 0.15,  // 保持松软
        damping: 0.4,   
        length: 0,
        render: {
          visible: debugMode,
          lineWidth: 2,
          strokeStyle: '#ffff00'
        }
      });
      
      Composite.add(world, fingerConstraint);
    }
  }
  
  
  // 添加这个函数来处理手指约束
  function handleFingerConstraint() {
    const touchRadius = 40; // 检测半径
    
    // 如果约束已存在，只需更新位置
    if (fingerConstraint) {
      updateFingerConstraint();
      return;
    }
    
    // 查找距离手指最近的物体
    let closestBody = null;
    let minDistance = touchRadius;
    
    for (let body of bodies) {
      if (body.isRemoved) continue;
      
      const physicsBody = body.body;
      const pos = physicsBody.position;
      
      // 计算到手指的距离
      const distX = pos.x - fingerPosition.x;
      const distY = pos.y - fingerPosition.y;
      const distance = Math.sqrt(distX * distX + distY * distY);
      
      // 选择最近的物体
      if (distance < minDistance + (body.sizeW + body.sizeH)/4) {
        closestBody = physicsBody;
        minDistance = distance;
      }
    }
    
    // 如果找到物体，创建约束
    if (closestBody) {
      // 标记物体可以离开画布
      for (let body of bodies) {
        if (body.body === closestBody) {
          body.canLeaveCanvas = true;
          body.markedForRemovalFrame = frameCount;
          break;
        }
      }
      
      // 创建约束
      constrainedBody = closestBody;
      fingerConstraint = Constraint.create({
        pointA: { x: fingerPosition.x, y: fingerPosition.y },
        bodyB: constrainedBody,
        pointB: { x: 0, y: 0 },
        stiffness: 0.15,  // 较软的弹性感
        damping: 0.5,    // 较强的阻尼减少振荡
        length: 0,
        render: {
          visible: debugMode,
          lineWidth: 2,
          strokeStyle: '#ffff00'
        }
      });
      
      Composite.add(world, fingerConstraint);
    }
  }
  
  