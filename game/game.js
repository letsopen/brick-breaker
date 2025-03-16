const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')
const splitBalls = [];
const hitSound = wx.createInnerAudioContext();

// 游戏配置
// 在游戏配置中添加特殊砖块相关配置
const config = {
  canvasWidth: canvas.width,
  canvasHeight: canvas.height,
  paddleHeight: 20,
  paddleWidth: 150,
  ballRadius: 10,
  brickRowCount: 5,  // 保持5列不变
  brickColumnCount: 5,
  brickPadding: 10,
  brickOffsetTop: 30,
  brickOffsetLeft: 30,
  ballSpeed: 4,
  speedUpMultiplier: 1.2,    // 加速倍数
  explosionRange: 1,         // 爆炸范围（砖块数）
  fadeOutDuration: 500,  // 砖块淡出动画持续时间（毫秒）
  splitBallCount: 2,    // 每次产生2个分裂球
  maxSplitBricks: 4     // 每局游戏最多1个分裂砖块
}

// 计算砖块宽度，使其自适应屏幕
config.brickWidth = (config.canvasWidth - 2 * config.brickOffsetLeft - (config.brickRowCount - 1) * config.brickPadding) / config.brickRowCount;
config.brickHeight = 20;

// 初始化挡板
const paddle = {
  x: config.canvasWidth / 2 - config.paddleWidth / 2,
  y: config.canvasHeight - config.paddleHeight - 10,
  width: config.paddleWidth,
  height: config.paddleHeight
}

// 初始化小球
// 在配置后添加游戏状态控制
const gameState = {
  started: false,
  paused: false,
  won: false
}

// 修改球的初始化
const ball = {
  x: config.canvasWidth / 2,
  y: config.canvasHeight - 30,
  dx: config.ballSpeed,
  dy: -config.ballSpeed,
  radius: config.ballRadius,
  stuck: true  // 新增状态，控制球是否粘在挡板上
}

// 添加游戏开始事件监听
wx.onTouchStart(() => {
  if (ball.stuck) {
    ball.stuck = false;
    gameState.started = true;
  }
});

// 添加胜利检测函数
function checkWin() {
  for (let c = 0; c < config.brickColumnCount; c++) {
    for (let r = 0; r < config.brickRowCount; r++) {
      if (bricks[c][r].status === 1) {
        return false;
      }
    }
  }
  return true;
}

// 修改游戏主循环
function draw() {
  ctx.clearRect(0, 0, config.canvasWidth, config.canvasHeight)
  
  drawBricks()
  drawBall()
  drawPaddle()

  // 绘制和更新分裂球
  for (let i = splitBalls.length - 1; i >= 0; i--) {
    const splitBall = splitBalls[i];
    
    // 绘制分裂球
    ctx.beginPath();
    ctx.arc(splitBall.x, splitBall.y, splitBall.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0095DD';
    ctx.fill();
    ctx.closePath();
    
    // 更新分裂球
    if (!handleBallCollisions(splitBall)) {
      splitBalls.splice(i, 1);
    }
  }
  
  // 如果球还粘在挡板上
  if (ball.stuck) {
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius;
  } else {
    collisionDetection()
    
    // 检查是否获胜
    if (checkWin()) {
      gameState.won = true;
      wx.showModal({
        title: '恭喜通关！',
        content: '点击确定重新开始',
        success: (res) => {
          if (res.confirm) {
            resetGame();
          }
        }
      });
      return;
    }
    
    // 优化墙壁碰撞检测
    const nextX = ball.x + ball.dx;
    const nextY = ball.y + ball.dy;
    
    // 左右墙壁碰撞
    if (nextX + ball.radius > config.canvasWidth || nextX - ball.radius < 0) {
      ball.dx = -ball.dx;
    }
    
    // 上墙碰撞
    if (nextY - ball.radius < 0) {
      ball.dy = -ball.dy;
    } else if (nextY + ball.radius > paddle.y) {
      // 挡板碰撞
      if (ball.x >= paddle.x - ball.radius && 
          ball.x <= paddle.x + paddle.width + ball.radius && 
          nextY + ball.radius >= paddle.y && 
          ball.y < paddle.y) {
        const hitPos = (ball.x - paddle.x) / paddle.width;
        const angle = -75 + (150 * hitPos);
        const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        const angleRad = angle * Math.PI / 180;
        
        ball.dx = speed * Math.sin(angleRad);
        ball.dy = -speed * Math.cos(angleRad);
        ball.y = paddle.y - ball.radius;
      } else if (nextY + ball.radius > config.canvasHeight) {
        // 游戏结束逻辑
// 检查是否还有其他活跃的球
if (splitBalls.length === 0) {
    // 游戏结束逻辑
    wx.showModal({
      title: '游戏结束',
      content: '点击确定重新开始',
      success: (res) => {
        if (res.confirm) {
          resetGame();
        }
      }
    });
    return;
  }
  // 如果还有其他球，则只移除当前主球
  ball.y = paddle.y - ball.radius;
  ball.stuck = true;
}
    }
    
    ball.x += ball.dx;
    ball.y += ball.dy;
  }
  
  requestAnimationFrame(draw);
}

// 初始化砖块数组（确保在游戏开始前就创建）
const bricks = [];
let splitBrickCount = 0;  // 记录分裂砖块数量
let speedBrickCount = 0;  // 记录加速砖块数量

for (let c = 0; c < config.brickColumnCount; c++) {
  bricks[c] = [];
  for (let r = 0; r < config.brickRowCount; r++) {
    let type = 0;  // 默认为普通砖块
    
    // 随机决定是否为特殊砖块
    if (Math.random() < 0.3) {
      if (splitBrickCount < 2 && Math.random() < 0.5) {
        type = 2;  // 分裂砖块
        splitBrickCount++;
      } else if (speedBrickCount < 1 && Math.random() < 0.3) {
        type = 1;  // 加速砖块
        speedBrickCount++;
      } else if (Math.random() < 0.3) {
        type = 3;  // 爆炸砖块
      }
    }
    
    bricks[c][r] = { 
      x: 0, 
      y: 0, 
      status: 1, 
      type: type,
      opacity: 1  // 添加透明度属性
    };
  }
}

// 启动游戏
draw();

// 添加球的碰撞处理函数（放在文件开头的函数定义区域）
// 修改球的碰撞处理函数
function handleBallCollisions(ball) {
    // 处理墙壁碰撞
    const nextX = ball.x + ball.dx;
    const nextY = ball.y + ball.dy;
    
    // 左右墙壁碰撞
    if (nextX + ball.radius > config.canvasWidth || nextX - ball.radius < 0) {
      ball.dx = -ball.dx;
    }
    
    // 上墙碰撞
    if (nextY - ball.radius < 0) {
      ball.dy = -ball.dy;
    } else if (nextY + ball.radius > paddle.y) {
      // 挡板碰撞
      if (ball.x >= paddle.x - ball.radius && 
          ball.x <= paddle.x + paddle.width + ball.radius && 
          nextY + ball.radius >= paddle.y && 
          ball.y < paddle.y) {
        const hitPos = (ball.x - paddle.x) / paddle.width;
        const angle = -75 + (150 * hitPos);
        const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        const angleRad = angle * Math.PI / 180;
        
        ball.dx = speed * Math.sin(angleRad);
        ball.dy = -speed * Math.cos(angleRad);
        ball.y = paddle.y - ball.radius;
        return true;
      } else if (nextY + ball.radius > config.canvasHeight) {
        return false;
      }
    }
    
    // 砖块碰撞
    // 砖块碰撞
    for (let c = 0; c < config.brickColumnCount; c++) {
        for (let r = 0; r < config.brickRowCount; r++) {
          const b = bricks[c][r];
          if (b.status === 1 && b.opacity === 1) {  // 只有完全不透明的砖块才能发生碰撞
            const ballCenterX = ball.x;
            const ballCenterY = ball.y;
            const brickCenterX = b.x + config.brickWidth / 2;
            const brickCenterY = b.y + config.brickHeight / 2;
            
            const distX = Math.abs(ballCenterX - brickCenterX);
            const distY = Math.abs(ballCenterY - brickCenterY);
            
            if (distX <= (config.brickWidth / 2 + ball.radius) && 
                distY <= (config.brickHeight / 2 + ball.radius)) {
              // 播放碰撞音效
              hitSound.play();
              
              if (distX <= config.brickWidth / 2) {
                ball.dy = -ball.dy;
              } else if (distY <= config.brickHeight / 2) {
                ball.dx = -ball.dx;
              } else {
                ball.dx = -ball.dx;
                ball.dy = -ball.dy;
              }
              
              // 触发特殊效果
              handleSpecialEffects(b, c, r);
              
              // 开始淡出动画
              startFadeOut(b);
              break;  // 一次只处理一个砖块的碰撞
            }
          }
        }
      }
    
    ball.x += ball.dx;
    ball.y += ball.dy;
    return true;
}

// 添加游戏重置函数
function resetGame() {

    splitBalls.length = 0;
  // 重置球的位置和状态
  ball.x = config.canvasWidth / 2;
  ball.y = config.canvasHeight - 30;
  ball.dx = config.ballSpeed;
  ball.dy = -config.ballSpeed;
  ball.stuck = true;
  
  // 重置挡板位置
  paddle.x = config.canvasWidth / 2 - config.paddleWidth / 2;
  
  // 重置砖块
  splitBrickCount = 0;
  speedBrickCount = 0;
  
  for (let c = 0; c < config.brickColumnCount; c++) {
    for (let r = 0; r < config.brickRowCount; r++) {
      let type = 0;
      
      if (Math.random() < 0.3) {
        if (splitBrickCount < 2 && Math.random() < 0.5) {
          type = 2;
          splitBrickCount++;
        } else if (speedBrickCount < 1 && Math.random() < 0.3) {
          type = 1;
          speedBrickCount++;
        } else if (Math.random() < 0.3) {
          type = 3;
        }
      }
      
      bricks[c][r] = { 
        x: 0, 
        y: 0, 
        status: 1, 
        type: type,
        opacity: 1 
      };
    }
  }
  // 重置分裂砖块计数
  splitBrickCount = 0;
  
  // 重置游戏状态
  gameState.started = false;
  gameState.won = false;
  
  // 重新开始游戏循环
  draw();
}

// 绘制球
function drawBall() {
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
  ctx.fillStyle = '#0095DD'
  ctx.fill()
  ctx.closePath()
}

// 绘制挡板
function drawPaddle() {
  ctx.beginPath()
  ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height)
  ctx.fillStyle = '#0095DD'
  ctx.fill()
  ctx.closePath()
}



// 添加特殊效果处理函数
function handleSpecialEffects(brick, col, row) {
  switch(brick.type) {
    case 1: // 加速砖块
      const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
      const angle = Math.atan2(ball.dy, ball.dx);
      const newSpeed = currentSpeed * config.speedUpMultiplier;
      ball.dx = newSpeed * Math.cos(angle);
      ball.dy = newSpeed * Math.sin(angle);
      break;
      
    case 2: // 分裂砖块
      createSplitBall();
      break;
      
    case 3: // 爆炸砖块
    for(let dc = -config.explosionRange; dc <= config.explosionRange; dc++) {
        for(let dr = -config.explosionRange; dr <= config.explosionRange; dr++) {
          const newCol = col + dc;
          const newRow = row + dr;
          if(newCol >= 0 && newCol < config.brickColumnCount && 
             newRow >= 0 && newRow < config.brickRowCount) {
            const targetBrick = bricks[newCol][newRow];
            if (targetBrick.status === 1) {  // 只处理未被销毁的砖块
              startFadeOut(targetBrick);  // 对每个受影响的砖块启动淡出动画
            }
          }
        }
      }
      break;
  }
}

// 修改分裂球创建函数
function createSplitBall() {
    const angles = [45, -45];
    const tempBalls = angles.map(angle => {
      const angleRad = angle * Math.PI / 180;
      const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
      return {
        x: ball.x,
        y: ball.y,
        dx: speed * Math.cos(angleRad),
        dy: -Math.abs(speed * Math.sin(angleRad)),
        radius: ball.radius
      };
    });
    
    splitBalls.push(...tempBalls);

  }

// 修改碰撞检测函数
function collisionDetection() {
    for (let c = 0; c < config.brickColumnCount; c++) {
        for (let r = 0; r < config.brickRowCount; r++) {
          const b = bricks[c][r];
          if (b.status === 1 && b.opacity === 1) {
        const ballCenterX = ball.x;
        const ballCenterY = ball.y;
        const brickCenterX = b.x + config.brickWidth / 2;
        const brickCenterY = b.y + config.brickHeight / 2;
        
        const distX = Math.abs(ballCenterX - brickCenterX);
        const distY = Math.abs(ballCenterY - brickCenterY);
        
        if (distX <= (config.brickWidth / 2 + ball.radius) && 
            distY <= (config.brickHeight / 2 + ball.radius)) {
          // 播放碰撞音效
          hitSound.play();
          
          // 确定碰撞方向并反弹
          if (distX <= config.brickWidth / 2) {
            ball.dy = -ball.dy;
          } else if (distY <= config.brickHeight / 2) {
            ball.dx = -ball.dx;
          } else {
            ball.dx = -ball.dx;
            ball.dy = -ball.dy;
          }
          
          // 触发特殊效果
          handleSpecialEffects(b, c, r);
          
          // 开始淡出动画
          startFadeOut(b);
        }
      }
    }
  }
}

// 修改砖块绘制函数，支持透明度
function drawBricks() {
  for (let c = 0; c < config.brickColumnCount; c++) {
    for (let r = 0; r < config.brickRowCount; r++) {
      const brick = bricks[c][r];
      if (brick.status === 1 || brick.opacity > 0) {
        const brickX = r * (config.brickWidth + config.brickPadding) + config.brickOffsetLeft;
        const brickY = c * (config.brickHeight + config.brickPadding) + config.brickOffsetTop;
        brick.x = brickX;
        brick.y = brickY;
        ctx.beginPath();
        ctx.rect(brickX, brickY, config.brickWidth, config.brickHeight);
        
        // 根据类型设置不同颜色并应用透明度
        let color;
        switch(brick.type) {
          case 1: color = 'rgba(255, 0, 0,'; break;   // 红色
          case 2: color = 'rgba(0, 255, 0,'; break;   // 绿色
          case 3: color = 'rgba(255, 165, 0,'; break; // 橙色
          default: color = 'rgba(0, 149, 221,';       // 蓝色
        }
        ctx.fillStyle = color + (brick.opacity || 1) + ')';
        ctx.fill();
        ctx.closePath();
      }
    }
  }
}

// 添加淡出动画函数
function startFadeOut(brick) {
  const startTime = Date.now();
  const fadeInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = elapsed / config.fadeOutDuration;
    
    if (progress >= 1) {
      clearInterval(fadeInterval);
      brick.status = 0;
      brick.opacity = 0;
    } else {
      brick.opacity = 1 - progress;
    }
  }, 16); // 约60fps的更新频率
}

// 触摸事件处理
wx.onTouchMove((res) => {
  const touch = res.touches[0]
  const newX = touch.clientX - config.paddleWidth / 2
  
  // 确保挡板不会移出画布
  if (newX >= 0 && newX + config.paddleWidth <= config.canvasWidth) {
    paddle.x = newX
  }
})

// 添加键盘控制
wx.onKeyDown((res) => {
  const moveSpeed = 20; // 每次移动的距离
  
  switch(res.keyCode) {
    case 37: // 左方向键
      const newLeftX = paddle.x - moveSpeed;
      if (newLeftX >= 0) {
        paddle.x = newLeftX;
      }
      break;
    case 39: // 右方向键
      const newRightX = paddle.x + moveSpeed;
      if (newRightX + paddle.width <= config.canvasWidth) {
        paddle.x = newRightX;
      }
      break;
    }
  }
)