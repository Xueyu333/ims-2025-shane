
// 添加一个重置未使用句子的函数
function resetUnusedPhrases() {
    // 复制所有句子到未使用数组
    unusedPhrases = phrases.slice();
    // 打乱顺序
    shuffleArray(unusedPhrases);
    console.log("Phrases shuffled, total:", unusedPhrases.length);
  }
  
  // Fisher-Yates 洗牌算法
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }




function addTextToBody(body) {
    // If no unused phrases, reset
    if (unusedPhrases.length === 0) {
        resetUnusedPhrases();
        usedPhrasesInCurrentCycle.clear(); // Reset tracking
    }
    
    // Take phrase and mark as used in this cycle
    const phrase = unusedPhrases.pop();
    usedPhrasesInCurrentCycle.add(phrase);
    
    bodyTexts.push({
        body: body,
        text: phrase,
        createdAt: frameCount,
        isVisible: true
    });
}
  
// 添加这个函数来渲染文本
function renderBodyTexts() {
    const textDisplayDuration = 300; // 5秒 (假设60帧/秒)
    const fadeOutDuration = 60; // 1秒的淡出时间
    
    // 更新和渲染文本
    for (let i = bodyTexts.length - 1; i >= 0; i--) {
      const textObj = bodyTexts[i];
      
      // 检查关联的物体是否还存在且未被移除
      const bodyIndex = bodies.findIndex(b => b === textObj.body);
      if (bodyIndex === -1 || textObj.body.isRemoved) {
        bodyTexts.splice(i, 1);
        continue;
      }
      
      // 检查显示时间
      const displayTime = frameCount - textObj.createdAt;
      if (displayTime > textDisplayDuration) {
        // 超过显示时间，移除文本
        bodyTexts.splice(i, 1);
        continue;
      }
      
      // 计算文本位置 - 在物体上方
      const pos = textObj.body.body.position;
      
      // 计算透明度 - 最后一秒淡出
      let alpha = 255;
      if (displayTime > textDisplayDuration - fadeOutDuration) {
        alpha = map(displayTime, textDisplayDuration - fadeOutDuration, textDisplayDuration, 255, 0);
      }
      
      // 计算文本位置，在物体上方
      const boxY = pos.y - textObj.body.sizeH/2 - 20;
      
      // 渲染文本
      push();
      if (typeof gameFont !== 'undefined' && gameFont) {
        textFont(gameFont);
      }
      

      textAlign(CENTER, CENTER);
      textSize(16);
      
      // 使用textWidth()计算实际文本宽度
      const actualTextWidth = textWidth(textObj.text);
      const padding = 20; // 文本两侧的额外空间
      const boxWidth = actualTextWidth + padding;
      const boxHeight = 30; // 增加高度，给文本更多空间
      
      // 添加文本背景以增加可读性
      fill(255, 255, 255, alpha * 0.9);
      noStroke();
      rectMode(CENTER);
      rect(pos.x, boxY, boxWidth, boxHeight, 5);
      
      // 渲染文本 - 与背景框使用相同的Y坐标
      fill(0, 0, 0, alpha);
      text(textObj.text, pos.x, boxY - 1);
      pop();
    }
  }
