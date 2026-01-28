
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

// --- CONFIGURATION ---
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 800;
const GROUND_Y = GAME_HEIGHT - 80;
const GRAVITY = 1.5;

canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// --- ASSET REPOSITORY ---
const images = {
    background: new Image(),
    hills: new Image(),
    platform: new Image(),
    platformSmallTall: new Image(),
    spriteStandRight: new Image(),
    spriteStandLeft: new Image(),
    spriteRunRight: new Image(),
    spriteRunLeft: new Image(),
    monster: new Image(),
    flagpole: new Image()
};

// image assets
images.background.src = 'img/background.png';
images.hills.src = 'img/hills.png';
images.platform.src = 'img/platform.png';
images.platformSmallTall.src = 'img/platformSmallTall.png';
images.spriteStandRight.src = 'img/spriteStandRight.png';
images.spriteStandLeft.src = 'img/spriteStandLeft.png';
images.spriteRunRight.src = 'img/spriteRunRight.png';
images.spriteRunLeft.src = 'img/spriteRunLeft.png';
images.monster.src = 'img/monster.png';
images.flagpole.src = 'img/flagpole.png';

// --- GLOBAL STATE ---
let score = 0;
let lives = 3;
let powerUpActive = false;
let powerUpTimer = 0;
let gameState = 'PLAYING';
let scrollOffset = 0;
let frameCount = 0;
let particles = [];
const keys = { right: false, left: false, up: false };

// --- ENTITY CLASSES ---

class Particle {
    constructor({ x, y, radius, color, velocity }) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.alpha = 1;
    }
    draw() {
        c.save();
        c.globalAlpha = this.alpha;
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        c.fillStyle = this.color;
        c.fill();
        c.restore();
    }
    update() {
        this.draw();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.02;
    }
}

class Player {
    constructor() {
        this.position = { x: 100, y: 100 };
        this.velocity = { x: 0, y: 0 };
        this.width = 66;
        this.height = 150;
        this.baseSpeed = 7;
        this.speed = 7;
        this.baseJump = -25; 
        this.jumpPower = -25;
        this.frames = 0;
        this.currentSprite = images.spriteStandRight;
        this.currentCropWidth = 177;
        this.facing = 'right';
        this.invincible = false;
        this.invincibleTimer = 0;
    }
    draw() {
        if (this.invincible && Math.floor(Date.now() / 80) % 2 === 0) c.globalAlpha = 0.2;
        if (this.currentSprite.complete) {
            c.drawImage(
                this.currentSprite,
                this.currentCropWidth * Math.floor(this.frames),
                0,
                this.currentCropWidth,
                400,
                this.position.x,
                this.position.y,
                this.width,
                this.height
            );
        }
        c.globalAlpha = 1.0;
    }
    update() {
        this.draw();
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        if (this.position.y + this.height + this.velocity.y <= GAME_HEIGHT) {
            this.velocity.y += GRAVITY;
        } else {
            // Respawn if falling out of world
            init();
        }
        if (this.invincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) this.invincible = false;
        }
    }
    takeDamage() {
        if (!this.invincible) {
            lives--;
            this.invincible = true;
            this.invincibleTimer = 100;
            createExplosion(this.position.x + this.width/2, this.position.y + this.height/2, '#ff4444');
            if (lives <= 0) gameState = 'GAMEOVER';
        }
    }
}

class Monster {
    constructor({ x, y, width = 70, height = 70, speed = 2, patrolDistance = 250 }) {
        this.position = { x, y };
        this.startX = x;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.patrolDistance = patrolDistance;
        this.direction = 1;
        this.killed = false;
    }
    draw() {
        if (this.killed) return;
        if (images.monster.complete) {
            c.save();
            if (this.direction === -1) {
                c.translate(this.position.x + this.width, this.position.y);
                c.scale(-1, 1);
                c.drawImage(images.monster, 0, 0, this.width, this.height);
            } else {
                c.drawImage(images.monster, this.position.x, this.position.y, this.width, this.height);
            }
            c.restore();
        }
    }
    update() {
        if (this.killed) return;
        this.draw();
        this.position.x += this.speed * this.direction;
        if (this.position.x > this.startX + this.patrolDistance) this.direction = -1;
        else if (this.position.x < this.startX - this.patrolDistance) this.direction = 1;
    }
}
class Platform {
    constructor({ x, y, image, width = 400, height = 80 }) {
        this.position = { x, y };
        this.width = width;
        this.height = height;
        this.image = image;
    }
    draw() {
        if (this.image.complete) {
            c.drawImage(this.image, this.position.x, this.position.y, this.width, this.height);
        }
    }
}

class PowerUp {
    constructor({ x, y, type = 'speed' }) {
        this.position = { x, y };
        this.width = 45;
        this.height = 45;
        this.type = type;
        this.collected = false;
    }
    draw() {
        if (this.collected) return;
        const bob = Math.sin(Date.now() / 150) * 12;
        const color = this.type === 'speed' ? '#ffcc00' : this.type === 'jump' ? '#00ff44' : '#00aaff';
        c.save();
        c.shadowBlur = 20;
        c.shadowColor = color;
        c.fillStyle = color;
        c.beginPath();
        c.arc(this.position.x + 22, this.position.y + 22 + bob, 18, 0, Math.PI * 2);
        c.fill();
        c.restore();
    }
}

class Flagpole {
    constructor({ x }) {
        this.position = { x, y: GROUND_Y - 400 };
        this.width = 100;
        this.height = 400;
    }
    draw() {
        if (images.flagpole.complete) {
            c.drawImage(images.flagpole, this.position.x, this.position.y, this.width, this.height);
        }
    }
}

class Parallax {
    constructor({ x, y, image, speed }) {
        this.position = { x, y };
        this.image = image;
        this.speed = speed;
    }
    draw() {
        if (this.image.complete) {
            c.drawImage(this.image, this.position.x, this.position.y);
            c.drawImage(this.image, this.position.x + 1200, this.position.y);
        }
    }
}

// --- CORE UTILITIES ---

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle({
            x, y, radius: Math.random() * 4, color,
            velocity: { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 }
        }));
    }
}

let player = new Player();
let platforms = [];
let monsters = [];
let powerUps = [];
let backgrounds = [];
let flagpole;

function init() {
    player = new Player();
    scrollOffset = 0; score = 0; lives = 3; 
    gameState = 'PLAYING'; particles = [];
    powerUpActive = false;

    backgrounds = [
        new Parallax({ x: 0, y: 0, image: images.background, speed: 0.1 }),
        new Parallax({ x: 0, y: 0, image: images.hills, speed: 0.5 })
    ];

    platforms = [
        new Platform({ x: -1, y: GROUND_Y, image: images.platform, width: 900 }),
        new Platform({ x: 1100, y: GROUND_Y, image: images.platform, width: 700 }),
        new Platform({ x: 2000, y: GROUND_Y, image: images.platform, width: 1500 }),
        // Floating Platforms
        new Platform({ x: 400, y: GROUND_Y - 180, image: images.platformSmallTall, width: 200, height: 45 }),
        new Platform({ x: 800, y: GROUND_Y - 320, image: images.platformSmallTall, width: 150, height: 45 }),
        new Platform({ x: 1400, y: GROUND_Y - 220, image: images.platformSmallTall, width: 250, height: 45 }),
    ];

    monsters = [
        new Monster({ x: 700, y: GROUND_Y - 70, speed: 2.5 }),
        new Monster({ x: 1400, y: GROUND_Y - 70, speed: 4 }),
        new Monster({ x: 2300, y: GROUND_Y - 70, speed: 2, patrolDistance: 500 }),
    ];

    powerUps = [
        new PowerUp({ x: 450, y: GROUND_Y - 250, type: 'speed' }),
        new PowerUp({ x: 850, y: GROUND_Y - 400, type: 'jump' }),
    ];

    flagpole = new Flagpole({ x: 3200 });
}

function handlePhysics() {
    // Platform Collisions
    platforms.forEach(plat => {
        if (player.position.y + player.height <= plat.position.y &&
            player.position.y + player.height + player.velocity.y >= plat.position.y &&
            player.position.x + player.width >= plat.position.x &&
            player.position.x <= plat.position.x + plat.width) {
            player.velocity.y = 0;
            player.position.y = plat.position.y - player.height;
        }
    });

    // Enemy Collisions
    monsters.forEach(m => {
        if (m.killed) return;
        // Head stomp
        if (player.velocity.y > 0 && 
            player.position.y + player.height >= m.position.y &&
            player.position.y + player.height <= m.position.y + m.height &&
            player.position.x + player.width >= m.position.x &&
            player.position.x <= m.position.x + m.width) {
            m.killed = true;
            player.velocity.y = -20;
            score += 500;
            createExplosion(m.position.x + m.width/2, m.position.y + m.height/2, 'orange');
        } else if (player.position.x + player.width >= m.position.x &&
                   player.position.x <= m.position.x + m.width &&
                   player.position.y + player.height >= m.position.y &&
                   player.position.y <= m.position.y + m.height) {
            player.takeDamage();
        }
    });

    // Win check
    if (player.position.x + player.width >= flagpole.position.x) gameState = 'WIN';
}

function animate() {
    requestAnimationFrame(animate);
    c.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'PLAYING') {
        frameCount++;
        backgrounds.forEach(b => b.draw());
        platforms.forEach(p => p.draw());
        flagpole.draw();
        monsters.forEach(m => m.update());
        powerUps.forEach(p => {
            p.draw();
            if (!p.collected && 
                player.position.x + player.width >= p.position.x && 
                player.position.x <= p.position.x + p.width &&
                player.position.y + player.height >= p.position.y &&
                player.position.y <= p.position.y + p.width) {
                p.collected = true;
                powerUpActive = true;
                powerUpTimer = 420;
                createExplosion(p.position.x, p.position.y, 'cyan');
                if (p.type === 'speed') player.speed = 14;
                if (p.type === 'jump') player.jumpPower = -32;
            }
        });

        particles.forEach((p, i) => { if (p.alpha <= 0) particles.splice(i, 1); else p.update(); });
        player.update();
        handlePhysics();

        if (powerUpActive) {
            powerUpTimer--;
            if (powerUpTimer <= 0) {
                powerUpActive = false;
                player.speed = player.baseSpeed;
                player.jumpPower = player.baseJump;
            }
        }

        // SCROLLING
        player.velocity.x = 0;
        if (keys.right && player.position.x < 500) player.velocity.x = player.speed;
        else if (keys.left && player.position.x > 100) player.velocity.x = -player.speed;
        else {
            if (keys.right) {
                scrollOffset += player.speed;
                platforms.forEach(p => p.position.x -= player.speed);
                monsters.forEach(m => { m.position.x -= player.speed; m.startX -= player.speed; });
                powerUps.forEach(p => p.position.x -= player.speed);
                flagpole.position.x -= player.speed;
                backgrounds.forEach(b => b.position.x -= player.speed * b.speed);
            } else if (keys.left && scrollOffset > 0) {
                scrollOffset -= player.speed;
                platforms.forEach(p => p.position.x += player.speed);
                monsters.forEach(m => { m.position.x += player.speed; m.startX += player.speed; });
                powerUps.forEach(p => p.position.x += player.speed);
                flagpole.position.x += player.speed;
                backgrounds.forEach(b => b.position.x += player.speed * b.speed);
            }
        }

        // ANIMATION LOGIC
        if (keys.right || keys.left) {
            player.currentSprite = keys.right ? images.spriteRunRight : images.spriteRunLeft;
            player.currentCropWidth = 341;
            if (frameCount % 6 === 0) player.frames++;
        } else {
            player.currentSprite = player.facing === 'right' ? images.spriteStandRight : images.spriteStandLeft;
            player.currentCropWidth = 177;
            if (frameCount % 12 === 0) player.frames++;
        }
        if (player.frames > 28) player.frames = 0;

        // UI
        c.fillStyle = 'white'; c.font = 'bold 28px Arial';
        c.fillText(`SCORE: ${score}`, 40, 50);
        c.fillText(`LIVES: ${lives}`, 40, 90);
        if (powerUpActive) c.fillText(`BOOST: ${Math.ceil(powerUpTimer/60)}s`, 40, 130);
    } else {
        c.fillStyle = 'rgba(0,0,0,0.85)'; c.fillRect(0,0, GAME_WIDTH, GAME_HEIGHT);
        c.fillStyle = gameState === 'WIN' ? '#FFD700' : '#FF3333';
        c.font = 'bold 80px Arial'; c.textAlign = 'center';
        c.fillText(gameState === 'WIN' ? 'LEVEL COMPLETE' : 'GAME OVER', GAME_WIDTH/2, GAME_HEIGHT/2);
        c.fillStyle = 'white'; c.font = '30px Arial';
        c.fillText("PRESS 'R' TO RESTART", GAME_WIDTH/2, GAME_HEIGHT/2 + 80);
        c.textAlign = 'left';
    }
}

window.addEventListener('keydown', ({ key }) => {
    switch(key.toLowerCase()) {
        case 'a': case 'arrowleft': keys.left = true; player.facing = 'left'; break;
        case 'd': case 'arrowright': keys.right = true; player.facing = 'right'; break;
        case 'w': case 'arrowup': case ' ': if(player.velocity.y === 0) player.velocity.y = player.jumpPower; break;
        case 'r': if (gameState !== 'PLAYING') init(); break;
    }
});
window.addEventListener('keyup', ({ key }) => {
    switch(key.toLowerCase()) {
        case 'a': case 'arrowleft': keys.left = false; break;
        case 'd': case 'arrowright': keys.right = false; break;
    }
});

init();
animate();