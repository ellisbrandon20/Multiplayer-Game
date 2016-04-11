/* game.js */ 
// DevLog https://docs.google.com/document/d/19USEq0-lkOCuyqLz8M2PJI1ccd0YC4jkxCCgurSIgUM/edit

// 733 = map height, 129 = title height
var game = new Phaser.Game(1000, 733+129, Phaser.AUTO, 'IntenseDefense', { preload: preload, create: create, update: update });

// Global Variables
var map;
var player;
var map;

var buttonGroup; // array of 4 zombie buttons and 4 tower buttons, and zombit path button
var zombieStatArray = []; // array of zombies (for server side)
var zombieArray = [];     // array of zombies (for client side)
var towerArray = [];      // array of towers

var towerBullets; // temp
var minigunBullets;
var shotgunBullets;
var bombBullets;

// Tower image following the mouse cursor once a tower button is clicked
var minigunTowerToBePlaced;
var shotgunTowerToBePlaced;
var gumTowerToBePlaced;
var bombTowerToBePlaced;

// Price for Zombies
var standardZombiePrice = 100; // i.e. prices.standardZombie
var strongZombiePrice = 200;
var healingZombiePrice = 300;
var generationsZombiePrice = 400;
// Price for Towers
var minigunTowerPrice = 100;
var shotgunTowerPrice = 200;
var gumTowerPrice = 300;
var bombTowerPrice = 400;

// Used to generate money for both players over time
var moneyTimer = 0;
var regenTime = 100;

// Some other constants
var bulletTravelTime = 450;
var baseHealth = 2000;
var spawn_x = 482, spawn_y = 160;

//curtain for the attacker, so attacker wont see where defender is placing towers for 30 seconds
var attackerCurtain;
var matchmakingCurtain;
var startRound = false; // controls the timer and money generator functions

var state; // either attacker or defender

// Attacker's choice to send zombies down lane default is center
var lane = 'center';

// Defender's choice
var gTowerType = ""; // flag && global variable for tower placement - g for global

// zombie bankrupt images ******************* will change this to array
var standardZombieBankrupt;
var strongZombieBankrupt;
var healingZombieBankrupt;
var generationsZombieBankrupt;

// Tower bankrupt images
var minigunTowerBankrupt;
var shotgunTowerBankrupt;
var gumTowerBankrupt;
var bombTowerBankrupt;

/* Classes */
// Player Class
Player = function(username, state, money) {
    this.username = username;
    this.state = state;
	this.money = money;
}
// Zombie Class
Zombie = function(type, lane, inX, inY) {
    this.type = type;
    this.lane = lane;
    this.pos_x = inX; // real positions topleft
	this.pos_y = inY; // real positions topleft
    this.alive = true;
   	this.time = game.time.now;
	
    if(type == 'standard')
	{
		this.damage = 100;
		this.health = 200;
		this.speed = 1;
	}
	else if(type == 'strong')
	{
		this.damage = 200;
		this.health = 300;
		this.speed = 0.6;
	}
	else if(type == 'healing')
	{
		this.damage = 50;
		this.health = 500;
		this.speed = 1;
	}
	else
	{
		this.damage = 300;
		this.health = 600;
		this.speed = 0.4
	}
	
	// positions calculated for bullet targeting
	if (lane == "center") {
		this.x = inX+57/2;  
		this.y = inY+75/2 + 30*(bulletTravelTime/1000)*this.speed;;
    }
	else if (lane == "left") {
		this.x = inX+57/2 - 50*(bulletTravelTime/1000)*this.speed;;
		this.y = inY+75/2;
    }
	else if (lane == "right") {
		this.x = inX+57/2 + 50*(bulletTravelTime/1000)*this.speed;;
		this.y = inY+75/2;
    }
	
	// individual zombie size: 57x75
    this.image = game.add.sprite(this.pos_x, this.pos_y, type+'Zombie');
	this.image.animations.add('moveRight',[0,1,2,3],true);
	this.image.animations.add('moveLeft',[4,5,6,7],true);
	this.image.animations.add('moveDown',[8,9,10,11],true);
	this.image.scale.setTo(0.5); // half of its original image size
	
    game.physics.enable(this.image, Phaser.Physics.ARCADE);
};
Zombie.prototype.move = function(newPos_x, newPos_y, newDirection) {
    
	// real zombie position
	this.pos_x = newPos_x;
    this.pos_y = newPos_y;

	// zombie image position
	this.image.x = newPos_x;
    this.image.y = newPos_y;
	
	this.direction = newDirection;

	// Change animation accordingly
	if(this.direction == 'down') {
		this.image.animations.play('moveDown',this.speed*10);
	}
	else if (this.direction == "right") {
		this.image.animations.play('moveRight',this.speed*10);
	}
	else if (this.direction == "left") {
		this.image.animations.play('moveLeft',this.speed*10);
	}

	var x_offset = 57/2, y_offset = 75/2; // zombie size ÷ 2
	
	// this.pos_x|y is the zombies' topleft position. 
	// this.x|y is adjusted with the x|y_offset, so we have their center positions
	this.x = this.pos_x + x_offset;
	this.y = this.pos_y + y_offset;
	
	// (x,y) coordinates for bullet-zombie overlap 
	// - where zombie would be by the time the bullet is supposed to hit the zombie
	if (this.direction == "down") {
		this.y = this.y + 30*(bulletTravelTime/1000)*this.speed;
	}
	else if (this.direction == "left") {
		this.x = this.x - 50*(bulletTravelTime/1000)*this.speed;
	}
	else if (this.direction == "right") {
		this.x = this.x + 50*(bulletTravelTime/1000)*this.speed;
	}
};
Zombie.prototype.hurt = function(damage, index) { // I SHOULD NOT NEED THE 2ND ARG
    this.health -= damage;
	console.log("bam");
    
    if (this.health <= 0) { // killing the zombie
        
        this.alive = false;
        this.image.kill();

		// create two more standard zombies
		if(zombieArray[index].type == 'generations'){
			for(var i = 0; i<2; i++) { 
				zombieStatArray.push(new zombieStat(zombieArray[index].lane, zombieArray[index].pos_x, zombieArray[index].pos_y-i*20, 100, 1));
				zombieArray.push(new Zombie('standard', zombieArray[index].lane, zombieArray[index].pos_x, zombieArray[index].pos_y-i*20));
			}
		}
				
		// Generate more money for defender
		if(zombieArray[index].type == 'generations')
			socket.send('defenderMoney 60');
		else if(zombieArray[index].type == 'standard')
			socket.send('defenderMoney 20');
		else if(zombieArray[index].type == 'strong')
			socket.send('defenderMoney 40');
		else // healer zombie
			socket.send('defenderMoney 40');
		
		// deleting the zombie object from the arrays
		zombieArray.splice(index, 1);
		zombieStatArray.splice(index,1);
		
        return true;
    }
    return false;
};

// Tower Class
Tower = function(type, x, y, spriteName, bullets) {
    this.type = type;
    // this.range = range; // make int if we use distanceBetween - from center
    this.pos_x = x-20; //tower's topleft position (displayed tower image size: 55x55)
    this.pos_y = y-25; //tower's topleft position (displayed tower image size: 55x55)
    this.game = game;
	this.bullets = towerBullets;
    this.nextFire = 0;

	if(type == 'minigun'){
		this.fireRate = 750;
		this.damage = 30;
	}
	else if(type == 'shotgun'){
		this.fireRate = 950;
		this.damage = 80;
	}
	else if(type == 'gum')
	{
		this.fireRate = 1000;
		this.damage = 0;
	}
	else { // bomb
		this.fireRate = 3000;
		this.damage = 150;
	}

    this.image = game.add.sprite(this.pos_x, this.pos_y, type+'Tower');
    this.image.scale.setTo(0.5); // half of its original image size (110x110)->(55,55)
    
    // this is so the attacker will not see the tower placements 
    if(player.state == 'attacker' && !startRound){
        this.image.sendToBack();
    }
    
    game.physics.enable(this.image, Phaser.Physics.ARCADE);
};
Tower.prototype.attack = function(underAttack) {
    console.log("att");
    if (this.game.time.now > this.nextFire && this.bullets.countDead() > 0) {
		
        this.nextFire = this.game.time.now + this.fireRate;
        
        var bullet = this.bullets.getFirstDead();
        
        var offset =36; // should be 36
        bullet.reset(parseInt(this.pos_x)+parseInt(offset), parseInt(this.pos_y)+parseInt(offset));
        
        bullet.rotation = this.game.physics.arcade.moveToObject(bullet, underAttack, 2, bulletTravelTime);
		
        // applying damage to zombie
        //underAttack.hurt(34, bullet, frontIndex);
    }
};

function zombieStat(_lane, _pos_x, _pos_y, _speed) {
	this.lane   = _lane;
	this.pos_x  = _pos_x;
	this.pos_y  = _pos_y;
	this.speed  = _speed;
	this.direction = "";
}
window.onload = function() {
    var playerName = prompt("Please enter your username:", "username");
    
  // Create a new WebSocket.
  socket = new WebSocket('ws://compute.cse.tamu.edu:11220', "echo-protocol");

    
  // Handle messages sent by the server.
  socket.onmessage = function(event) {
	  var message = event.data;
	 // var type = 'string';
		if(message == 'Attacker'){
			state = 'attacker';
			console.log(state);
			//document.getElementById("state").innerHTML = "Attacker";
            player = new Player(playerName, state, 2000);
            console.log(player.username + ' ' + player.state);
            document.getElementById("attacker-name").innerHTML = "Attacker: " + player.username;
		}
		else if(message == 'Defender'){
			state = 'defender';
			console.log(state);
			//document.getElementById("state").innerHTML = "Defender";
             player = new Player(playerName, state, 1000);
            console.log(player.username + ' ' + player.state);
            document.getElementById("defender-name").innerHTML = "Defender: " + player.username;
		}
		else if(message == 'Observer'){
			state = 'observer';
			console.log(state);
			//document.getElementById("state").innerHTML = "Observer";
            player = new Player(playerName, state, 2000);
            console.log(player.username + ' ' + player.state);
		}
		else if(message.length > 9 && message.substring(0,9) == 'addZombie')
			buyZombie(message.substring(9, message.length));
		else if(message == 'incoming')
			incoming = true;
		else if(message.substring(0,13) == 'defenderMoney'){
			if(state == 'defender')
				player.money+=parseInt(message.substring(14,message.length));
		}
		else if(message.length > 8 && message.substring(0,8) == 'addTower')
		{
			var commaCounter = 0;
			var towerType = '';
			var pos_x = '';
			var pos_y = '';		
			for(i = 0; i<message.length; i++)
			{
				if(commaCounter<1)
				{
					if(message[i] == ',')
						commaCounter++			
				}			
				else if(commaCounter == 1)
				{
					if(message[i] != ',')
						towerType += message[i];
					else
						commaCounter++;			
				}
				else if(commaCounter == 2)
				{
					if(message[i] != ',')
						pos_x += message[i];
					else
						commaCounter++;			
				}
				else
					pos_y+=message[i];
				
			}
			towerArray.push(new Tower(towerType, pos_x, pos_y));
			
		}
        else if(message == "startRound")
        {
            // destroy the curatin and bring the tower sprites to the front so the attacker can see them now
            if(player.state == 'attacker'){
                attackerCurtain.destroy();
                for (var i=0; i< towerArray.length; i++)
                    towerArray[i].image.bringToTop();
            }
            
            console.log("recieved start round");
            startRound = true;
            countdown(5);
        }
        else if(message.substring(0,12) == 'attackerName')
        {
            attackerName = message.substring(13, message.length);
            document.getElementById("attacker-name").innerHTML = "Attacker: " + attackerName;
        }
        else if(message.substring(0,12) == 'defenderName')
        {
            defenderName = message.substring(13, message.length);
            document.getElementById("defender-name").innerHTML = "Defender: " + defenderName;
        }
        else if(message == "defenderPlaceTowers")
        {
            console.log("defenderplacetowers");
           // if(player.state == 'defender'){
                
            //}
            if(player.state == 'attacker'){
                matchmakingCurtain.destroy();
                attackerCurtain = game.add.sprite(0,129,'attckerCurtain');
            }
            
            socket.send(player.state + 'Name ' + player.username);
            console.log("Defender start placing towers!");
            countdown(.01); // extra second for login time
        }
		else
		{
			var receivedArray = JSON.parse(message);
			if(typeof(receivedArray[0]) == 'number'){
				for(var i = 0; i<receivedArray.length; i++)
					damageBase(receivedArray[i]);
			}
			else{
				if(receivedArray.length == zombieStatArray.length){
						zombieStatArray = receivedArray;
					for(var i = 0; i<zombieStatArray.length; i++) {
						zombieArray[i].move(zombieStatArray[i].pos_x, zombieStatArray[i].pos_y, zombieStatArray[i].direction);        
					}
				}
			}
		}
	}
}

function preload() { // Preload stuff for the game like images
    
    game.load.image('title','images/Title.png');
	game.load.spritesheet('map','images/mapSpriteSheet.png', 700,735);
	game.load.image('base','images/base.png');
	
    
	/* images for buttons */
	//zombie path button
    game.load.spritesheet('zombiePathButton', 'images/generalButtons/zombiePathButton.png', 50,50);
    //zombies
    game.load.spritesheet('standardZombieButton', 'images/Zombies/zombieStandardButtonSpt.png', 70, 70);
    game.load.spritesheet('strongZombieButton', 'images/Zombies/zombieStrongButtonSpt.png', 70,70);
    game.load.spritesheet('healingZombieButton', 'images/Zombies/zombieHealingButtonSpt.png', 70,70);
    game.load.spritesheet('generationsZombieButton', 'images/Zombies/zombieGenerationsButtonSpt.png', 70,70);
    // image displayed instead of button if player cant afford it
    game.load.image('zombieBankrupt', 'images/Zombies/zombieBankrupt.png');
    
	//tower buttons
    game.load.spritesheet('minigunTowerButton', 'images/Towers/towerMinigunButtonSpt.png', 70, 70);
    game.load.spritesheet('shotgunTowerButton', 'images/Towers/towerShotgunButtonSpt.png', 70, 70);
    game.load.spritesheet('gumTowerButton', 'images/Towers/towerGumButtonSpt.png', 70, 70);
    game.load.spritesheet('bombTowerButton', 'images/Towers/towerBombButtonSpt.png', 70, 70);
	// image displayed instead of button if player cant afford it
	game.load.image('minigunBankrupt', 'images/Towers/minigunBankrupt.png');
	game.load.image('shotgunBankrupt', 'images/Towers/shotgunBankrupt.png');
    game.load.image('gumBankrupt', 'images/Towers/gumBankrupt.png');
    game.load.image('bombBankrupt', 'images/Towers/bombBankrupt.png');
	
    
	
	
	/* images for the actual objects on the map */
	//towers
	game.load.spritesheet('minigunTower', 'images/Towers/towerStandard.png');
    game.load.spritesheet('shotgunTower', 'images/Towers/towerShotgun.png');
    game.load.spritesheet('gumTower', 'images/Towers/towerGum.png');
    game.load.spritesheet('bombTower', 'images/Towers/towerBomb.png');
	
	game.load.spritesheet('standardZombie', 'images/Zombies/zombieStandard.png', 57,75);
    game.load.spritesheet('strongZombie', 'images/Zombies/zombieStrong.png', 57, 75);
    game.load.spritesheet('healingZombie', 'images/Zombies/zombieHealing.png', 57, 75);
    game.load.spritesheet('generationsZombie', 'images/Zombies/zombieGenerations.png', 57, 75);
    
    // bullet used for now to shoot from the towers, image will be changed later
    game.load.image('bullet', 'images/bullet.png');
    
    //curtain for the attacker, so attacker wont see where defender is placing towers for 30 seconds
    game.load.spritesheet('attckerCurtain', 'images/attackerCurtain.png');
    //curtain for both players, When first loggin in will be presented this image hiding the map 
    game.load.spritesheet('matchmakingCurtain', 'images/matchmaking.png');
    
    game.load.image('zombieSpawn', 'images/zombieSpawn.png');

}
function create() {
    
    game.physics.startSystem(Phaser.Physics.ARCADE);

    /* load images on the background */
    game.stage.backgroundColor = "#e5e1db"; // gray background color
    game.add.sprite(0,0,'title');
    
    map = game.add.sprite(144,129,'map');
	map.animations.add('plainMap', [0], true);
	map.animations.add('towerPlacement', [1], true);
	map.play('plainMap');
    map.inputEnabled = true;
    map.events.onInputDown.add(mouseClick, this);
    var base = game.add.sprite(432,780,'base');
	
	/* Creating each button */
    // Zombie Buttons
    var standardZombieButton = game.make.button(40, 160, 'standardZombieButton', function(){sendAddZombie("standard");}, this, 0, 1, 2);
    var strongZombieButton  =  game.make.button(40, 320, 'strongZombieButton', function(){sendAddZombie("strong");}, this, 0, 1, 2);
    var healingZombieButton  =  game.make.button(40, 480, 'healingZombieButton', function(){sendAddZombie("healing");}, this, 0, 1, 2);
    var generationsZombieButton  =  game.make.button(40, 640, 'generationsZombieButton', function(){sendAddZombie("generations");}, this, 0, 1, 2);
    // Tower Buttons
    var minigunTowerButton  =  game.make.button(870, 160, 'minigunTowerButton', function(){buyTower("minigun");}, this, 0, 1, 2);
    var shotgunTowerButton  =  game.make.button(870, 320, 'shotgunTowerButton', function(){buyTower("shotgun");}, this, 0, 1, 2);
    var gumTowerButton  =  game.make.button(870, 480, 'gumTowerButton', function(){buyTower("gum");}, this, 0, 1, 2);
    var bombTowerButton  =  game.make.button(870, 640, 'bombTowerButton', function(){buyTower("bomb");}, this, 0, 1, 2);
    
	/* Attaching buttons to the screen */
    buttonGroup = game.add.group();
    //zombie buttons
    buttonGroup.add(standardZombieButton);
    buttonGroup.add(strongZombieButton);
    buttonGroup.add(healingZombieButton);
    buttonGroup.add(generationsZombieButton);
    //tower buttons
    buttonGroup.add(minigunTowerButton);
    buttonGroup.add(shotgunTowerButton);
    buttonGroup.add(gumTowerButton);
    buttonGroup.add(bombTowerButton);
    
    // Zombie bankrupt images - 
        //I have to add the sprite and then kill it so the webpage knows of its existence, and its easier to use the reset() function
    standardZombieBankrupt = game.add.sprite(40, 160, 'zombieBankrupt');
    standardZombieBankrupt.kill(); // temporarily kill the image
    strongZombieBankrupt = game.add.sprite(40, 320, 'zombieBankrupt');
    strongZombieBankrupt.kill(); // temporarily kill the image
    healingZombieBankrupt = game.add.sprite(40, 480, 'zombieBankrupt');
    healingZombieBankrupt.kill(); // temporarily kill the image
    generationsZombieBankrupt = game.add.sprite(40, 640, 'zombieBankrupt');
    generationsZombieBankrupt.kill(); // temporarily kill the image
    
    // Tower bankrupt images -
        ////I have to add the sprite and then kill it so the webpage knows of its existence, and its easier to use the reset() function
    minigunTowerBankrupt = game.add.sprite(870, 160, 'minigunBankrupt');
    minigunTowerBankrupt.kill();
    shotgunTowerBankrupt = game.add.sprite(870, 320, 'shotgunBankrupt');
    shotgunTowerBankrupt.kill();
    gumTowerBankrupt = game.add.sprite(870, 480, 'gumBankrupt');
    gumTowerBankrupt.kill();
    bombTowerBankrupt = game.add.sprite(870, 640, 'bombBankrupt');
    bombTowerBankrupt.kill();

	if(player.state == 'attacker'){
		//zombie path button (the red arrow on top of map)
		var zombiePathButton = game.make.button(472,160, 'zombiePathButton', changePath, this, 0, 1, 2);
		buttonGroup.add(zombiePathButton);
		
		currentPathFrame = 0;
	}
    
    if(player.state == 'defender') {
		// zombie tombstone image where zombies spawn
        var zombieSpawn = game.add.image(470, spawn_y, 'zombieSpawn');
        zombieSpawn.scale.setTo(0.1); 
    }
    
    //  The tower bullet groups
    towerBullets = game.add.group(); // TEMP
    towerBullets.enableBody = true;
    towerBullets.physicsBodyType = Phaser.Physics.ARCADE;
    towerBullets.createMultiple(40, 'bullet'); // creating 40 bullet sprites
    
    towerBullets.setAll('anchor.x', 0.5); // center of the object - not topleft
    towerBullets.setAll('anchor.y', 0.5); // center of the object - not topleft
	towerBullets.setAll('scale.x', 0.5);  // reducing the size to half of its original image size
	towerBullets.setAll('scale.y', 0.5);  // reducing the size to half of its original image size
	
	/* WILL CHANGE ONCE BRANDON'S MAKES ALL BULLET IMAGES
	minigunBullets = game.add.group();
    minigunBullets.enableBody = true;
	minigunBullets.physicsBodyType = Phaser.Physics.ARCADE;
    minigunBullets.createMultiple(30, '_____'); // creating 30 bullet sprites

    minigunBullets.setAll('anchor.x', 0.5); // center of the object - not topleft
    minigunBullets.setAll('anchor.y', 0.5); // center of the object - not topleft

	shotgunBullets = game.add.group();
    shotgunBullets.enableBody = true;
	shotgunBullets.physicsBodyType = Phaser.Physics.ARCADE;
    shotgunBullets.createMultiple(30, '_____'); // creating 30 bullet sprites

    shotgunBullets.setAll('anchor.x', 0.5); // center of the object - not topleft
    shotgunBullets.setAll('anchor.y', 0.5); // center of the object - not topleft

	bombBullets    = game.add.group();
    bombBullets.enableBody = true;
	bombBullets.physicsBodyType = Phaser.Physics.ARCADE;
    bombBullets.createMultiple(30, '_____'); // creating 30 bullet sprites

    bombBullets.setAll('anchor.x', 0.5); // center of the object - not topleft
    bombBullets.setAll('anchor.y', 0.5); // center of the object - not topleft
	*/
	
	/* Price labels for the zombie/tower buttons */
	// Same style for each text
	var style = {font: "20px Arial", fill: "#29a329", align: "center" };
	//zombie price tags
	var standardZombieText = game.add.text(50, 240, "$100", style);
	var strongZombieText = game.add.text(50, 400, "$200", style);
	var healingZombieText = game.add.text(50, 560, "$300", style);
	var generationsZombieText = game.add.text(50, 720, "$400", style);
	//tower price tags
	var minigunTowerText = game.add.text(885, 240, "$100", style);
	var shotgunTowerText = game.add.text(885, 400, "$200", style);
	var gumTowerText = game.add.text(885, 560, "$300", style);
	var bombTowerText = game.add.text(885, 720, "$400", style);
    
    if (player.state == 'attacker')
        matchmakingCurtain = game.add.sprite(0,129,'matchmakingCurtain');
    
    if (player.state == 'defender') {
        minigunTowerToBePlaced = game.add.sprite(game.world.centerX, game.world.centerY, 'minigunTower');
        shotgunTowerToBePlaced = game.add.sprite(game.world.centerX, game.world.centerY, 'shotgunTower');
        gumTowerToBePlaced = game.add.sprite(game.world.centerX, game.world.centerY, 'gumTower');
        bombTowerToBePlaced = game.add.sprite(game.world.centerX, game.world.centerY, 'bombTower');

        minigunTowerToBePlaced.anchor.set(0.5);
        shotgunTowerToBePlaced.anchor.set(0.5);
        gumTowerToBePlaced.anchor.set(0.5);
        bombTowerToBePlaced.anchor.set(0.5);

        // Half of the size
        minigunTowerToBePlaced.scale.setTo(0.5);
        shotgunTowerToBePlaced.scale.setTo(0.5);
        gumTowerToBePlaced.scale.setTo(0.5);
        bombTowerToBePlaced.scale.setTo(0.5);
        
        //  And enable the Sprite to have a physics body:
        game.physics.arcade.enable(minigunTowerToBePlaced);
        game.physics.arcade.enable(shotgunTowerToBePlaced);
        game.physics.arcade.enable(gumTowerToBePlaced);
        game.physics.arcade.enable(bombTowerToBePlaced);
        
        minigunTowerToBePlaced.kill();
        shotgunTowerToBePlaced.kill();
        gumTowerToBePlaced.kill();
        bombTowerToBePlaced.kill();
    }
    
}

function newRound() {
	for(var i = 0; i<zombieArray.length; i++)
		zombieArray[i].image.kill();
	for(var j = 0; j<towerArray.length; j++)
		towerArray[j].image.kill();
	
	zombieArray = [];
	zombieStatArray = [];
	towerArray = [];
}
function countdown(minutes) { // function for the timer for each round

	// adjusted this function to allow a 30 second timer as well
    var seconds = 60;
    var mins = minutes;
    var counter;
	
    if(mins < 1){
        seconds = mins*100;
        mins = 0;
        console.log(mins+":"+seconds);
        counter = document.getElementById("gameStartTimer");
    }
    else{
        counter = document.getElementById("timer");
    }
    function tick() {
        
        //var counter = document.getElementById("timer");
        //counter = document.getElementById("gameStartTimer");
        var current_minutes;
        if(mins<1){
            current_minutes = 0;
        }
        else{
            current_minutes = mins-1
        }
        seconds--;
        counter.innerHTML = current_minutes.toString() + ":" + (seconds < 10 ? "0" : "") + String(seconds);
        if(mins<1){
           if(seconds == 0 && current_minutes == 0){
                socket.send("startRound");
               console.log("start Round");
                // tower placement done start game allow both players to start playing now
           }   
        }
        else{
            if(seconds == 0 && current_minutes == 0){
                endRound('defender');         
                //end of match attacker wins
            }
		}
        if( seconds > 0 ) {
            setTimeout(tick, 1000);
        } else {
 
            if(mins > 1){
 
               // countdown(mins-1);   never reach “00″ issue solved:Contributed by Victor Streithorst
               setTimeout(function () { countdown(mins - 1); }, 1000);
 
            }
        }
    }
    tick();
}
function changePath(){
    /*
        frame #     Zombie path
            0           center
            3           right
            6           left
    */

	// buttonGroup.getAt(8) == arrow button for attacker
    if(currentPathFrame == 0) {
        buttonGroup.getAt(8).setFrames(3,4,5);
		lane = 'right';
    }
    else if(currentPathFrame == 3) {
        buttonGroup.getAt(8).setFrames(6,7,8);
		lane = 'left';
    }
    else if(currentPathFrame == 6){
        buttonGroup.getAt(8).setFrames(0,1,2);
		lane = 'center';
    }
    currentPathFrame = buttonGroup.getAt(8).frame;
}
function damageBase(index) {
	baseHealth -= zombieArray[index].damage;
    document.getElementById("health").innerHTML = " Health: " + baseHealth; 
	
	// Killing the zombie and removing it from the arrays
	zombieArray[index].alive = false;    
	zombieArray[index].image.kill();
	zombieArray.splice(index, 1);
	zombieStatArray.splice(index,1);
	
	if(baseHealth <= 0)
		endRound('attacker');
	
	// inside the countdown(), endRound('defender') will be called accordingly
	
	return true;
}
function endRound(winner) {
	if(winner == "attacker")
		window.alert("Attacker Wins!");
	else
		window.alert("Defender Wins!");
	
    startRound = false;
	newRound();
}

function sendAddZombie(zombieType){ 
    // check if the player has enough money for the zombie
    var canBuy = false;
	
    if(player.state == 'attacker'){
		
        if(zombieType == "standard"){
            if( player.money < standardZombiePrice ){
                document.getElementById("attacker-money").innerHTML = "Money: $" + player.money + " - Not enough money";
            }
            else{
                canBuy = true;
                player.money -= 100;
                document.getElementById("attacker-money").innerHTML = "Money: $" + player.money;
            }
        }
        else if(zombieType == "strong"){
            if( player.money < strongZombiePrice ){
                document.getElementById("attacker-money").innerHTML = "Money: $" + player.money + " - Not enough money";
            }
            else{
                canBuy = true;
                player.money -= 200;
                document.getElementById("attacker-money").innerHTML = "Money: $" + player.money;
            }
        }
        else if(zombieType == "healing"){
            if( player.money < healingZombiePrice ){
                document.getElementById("attacker-money").innerHTML = "Money: $" + player.money + " - Not enough money";
            }
            else{
                canBuy = true;
                player.money -= 300;
                document.getElementById("attacker-money").innerHTML = "Money: $" + player.money;
            }
        }
        else if(zombieType == "generations"){
            if( player.money < generationsZombiePrice ){
                document.getElementById("attacker-money").innerHTML = "Money: $" + player.money + " - Not enough money";
            }
            else{
                canBuy = true;
                player.money -= 400;
                document.getElementById("attacker-money").innerHTML = "Money: $" + player.money;
            }
        }
		
		if(canBuy){
			socket.send("addZombie"+zombieType); // this will call buyZombie()
		}
    }
}
function buyZombie(type) {
	/* Attacker's money amount is checked and deducted accordingly 
	   by the caller of this function, "sendAddZombie" */
	
    if (type == "standard"){
		zombieStatArray.push(new zombieStat(lane, spawn_x, spawn_y, 1));
		zombieArray.push(new Zombie(type, lane, spawn_x, spawn_y));
	}
    else if (type == "strong"){
		zombieStatArray.push(new zombieStat(lane, spawn_x, spawn_y, 0.6));
		zombieArray.push(new Zombie(type, lane, spawn_x, spawn_y));
	}
	else if (type == "healing"){
		zombieStatArray.push(new zombieStat(lane, spawn_x, spawn_y, 1));
		zombieArray.push(new Zombie(type, lane, spawn_x, spawn_y));
	}
    else if (type == "generations"){
		zombieStatArray.push(new zombieStat(lane, spawn_x, spawn_y, 0.3));
		zombieArray.push(new Zombie(type, lane, spawn_x, spawn_y));
	}
}
function buyTower(type) {
    /* this turns on the flag only.
     in mouseClick(item){}, it will place a tower if a tower is clicked then click on a map */
    
    // If another tower is already selected, then kill the image
    if      (gTowerType == 'minigun')   minigunTowerToBePlaced.kill();
    else if (gTowerType == 'shotgun')   shotgunTowerToBePlaced.kill();
    else if (gTowerType == 'gum')       gumTowerToBePlaced.kill();
    else if (gTowerType == 'bomb')      bombTowerToBePlaced.kill();
    
    gTowerType = type;

    // Tower image is called to follow the mouse cursor until it is placed
    if      (gTowerType == 'minigun')   minigunTowerToBePlaced.reset(870,160);
    else if (gTowerType == 'shotgun')   shotgunTowerToBePlaced.reset(870,320);
    else if (gTowerType == 'gum')       gumTowerToBePlaced.reset(870,480);
    else if (gTowerType == 'bomb')      bombTowerToBePlaced.reset(870,640);
    
    if(player.state == 'defender')
		map.play('towerPlacement');
    
    
}
function mouseClick(item) {
	var notOnLane = false;
	var canBuy = false;

	if(player.state == 'defender'){
		
		// game.input.mousePointer.x|y: mouse cursor position.
		var mouse_x = game.input.mousePointer.x;
		var mouse_y = game.input.mousePointer.y;
		
		// Check if the defender is trying to place the tower on zombie lanes
		if(mouse_x >= 185 && mouse_x <= 800 && mouse_y <= 215) {
			document.getElementById("Tower-Placement-Error").innerHTML = "Sorry, You can't place towers on the paths"; 
		}
		else if(mouse_x >= 185 && mouse_x <= 278 && mouse_y >= 162 && mouse_y <= 752) {
			document.getElementById("Tower-Placement-Error").innerHTML = "Sorry, You can't place towers on the paths";
		}
		else if(mouse_x >= 708 && mouse_x <= 800 && mouse_y >= 162 && mouse_y <= 752) {
			document.getElementById("Tower-Placement-Error").innerHTML = "Sorry, You can't place towers on the paths";
		}
		else if(mouse_x >= 201 && mouse_x <= 771 && mouse_y >= 666 && mouse_y <= 750) {
			document.getElementById("Tower-Placement-Error").innerHTML = "Sorry, You can't place towers on the paths";
		}
		else if(mouse_x >= 447 && mouse_x <= 540 && mouse_y >= 210 && mouse_y <= 820) {
			document.getElementById("Tower-Placement-Error").innerHTML = "Sorry, You can't place towers on the paths";
		}
		else if(mouse_x >= 147 && mouse_x <= 817 && mouse_y >= 820 && mouse_y <= 858) {
			document.getElementById("Tower-Placement-Error").innerHTML = "Sorry, You can't place towers on the paths"; 
		}
		else if(mouse_x >= 410 && mouse_x <= 560 && mouse_y >= 750) {
			document.getElementById("Tower-Placement-Error").innerHTML = "Sorry, You can't place towers on the paths"; 
		}
		else {
			notOnLane = true;
		}
		
		// Check if the player has enough money for the zombie
		if (gTowerType == "minigun") {
			if(player.money < minigunTowerPrice){
				document.getElementById("defender-money").innerHTML = "Money: $" + player.money + " - Not enough money";
			}
			else{
				canBuy = true;
				player.money -= minigunTowerPrice;
				document.getElementById("defender-money").innerHTML = "Money: $" + player.money;
			}
		}
		else if (gTowerType == "shotgun") {
			if(player.money < shotgunTowerPrice){
				document.getElementById("defender-money").innerHTML = "Money: $" + player.money + " - Not enough money";
			}
			else{
				canBuy = true;
				player.money -= shotgunTowerPrice;
				document.getElementById("defender-money").innerHTML = "Money: $" + player.money;
			}
		}
		else if (gTowerType == "gum") {
			if(player.money < gumTowerPrice){
				document.getElementById("defender-money").innerHTML = "Money: $" + player.money + " - Not enough money";
			}
			else{
				canBuy = true;
				player.money -= gumTowerPrice;
				document.getElementById("defender-money").innerHTML = "Money: $" + player.money;
			}
		}
		else if (gTowerType == "bomb") {
			if(player.money < bombTowerPrice){
				document.getElementById("defender-money").innerHTML = "Money: $" + player.money + " - Not enough money";
			}
			else{
				canBuy = true;
				player.money -= bombTowerPrice;
				document.getElementById("defender-money").innerHTML = "Money: $" + player.money;
			}
		}
		
		if(notOnLane && canBuy) {
			map.play('plainMap');
			document.getElementById("Tower-Placement-Error").innerHTML = "";
			socket.send('addTower,'+gTowerType+','+mouse_x+','+mouse_y);
            
            if      (gTowerType == 'minigun')   minigunTowerToBePlaced.kill();
            else if (gTowerType == 'shotgun')   shotgunTowerToBePlaced.kill();
            else if (gTowerType == 'gum')       gumTowerToBePlaced.kill();
            else if (gTowerType == 'bomb')      bombTowerToBePlaced.kill();
            
			gTowerType = "";
		}
	}
}

function update() {

    // Allow tower image to follow the mouse cursor when a tower button is clicked
    if (player.state == 'defender') {
        if (gTowerType == 'minigun') {
            if (game.physics.arcade.distanceToPointer(minigunTowerToBePlaced, game.input.activePointer) > 1) {
                game.physics.arcade.moveToPointer(minigunTowerToBePlaced, 300, game.input.activePointer, 10);
            }
            if (game.physics.arcade.distanceToPointer(minigunTowerToBePlaced, game.input.activePointer) > 0.1) {
                game.physics.arcade.moveToPointer(minigunTowerToBePlaced, 300, game.input.activePointer, 50);
            }
        }
        else if (gTowerType == 'shotgun') {
            if (game.physics.arcade.distanceToPointer(shotgunTowerToBePlaced, game.input.activePointer) > 1) {
                game.physics.arcade.moveToPointer(shotgunTowerToBePlaced, 300, game.input.activePointer, 10);
            }
            if (game.physics.arcade.distanceToPointer(shotgunTowerToBePlaced, game.input.activePointer) > 0.1) {
                game.physics.arcade.moveToPointer(shotgunTowerToBePlaced, 300, game.input.activePointer, 50);
            }
        }
        else if (gTowerType == 'gum') {
            if (game.physics.arcade.distanceToPointer(gumTowerToBePlaced, game.input.activePointer) > 1) {
                game.physics.arcade.moveToPointer(gumTowerToBePlaced, 300, game.input.activePointer, 10);
            }
            if (game.physics.arcade.distanceToPointer(gumTowerToBePlaced, game.input.activePointer) > 0.1) {
                game.physics.arcade.moveToPointer(gumTowerToBePlaced, 300, game.input.activePointer, 50);
            }
        }
        else if (gTowerType == 'bomb') {
            if (game.physics.arcade.distanceToPointer(bombTowerToBePlaced, game.input.activePointer) > 1) {
                game.physics.arcade.moveToPointer(bombTowerToBePlaced, 300, game.input.activePointer, 10);
            }
            if (game.physics.arcade.distanceToPointer(bombTowerToBePlaced, game.input.activePointer) > 0.1) {
                game.physics.arcade.moveToPointer(bombTowerToBePlaced, 300, game.input.activePointer, 50);
            }
        }
    }
    
    //gradually add money to both players
    if(startRound){
        moneyTimer++;
		
        if(moneyTimer >= regenTime)
        {
            if(player.state == 'attacker'){
				player.money += 50;
                document.getElementById("attacker-money").innerHTML = "Money: $" + player.money;
            }
            else // defender
                document.getElementById("defender-money").innerHTML = "Money: $" + player.money;
				moneyTimer = 0;
        }
    }
    
    // check if the attacker has enough money for zombie buttons
    if(player.state == 'attacker')
    {
        minigunTowerBankrupt.reset(870, 160);
        shotgunTowerBankrupt.reset(870, 320);
        gumTowerBankrupt.reset(870, 480);
        bombTowerBankrupt.reset(870, 640);
        
        var currentMoney = player.money;
        // standard zombie button
        if(currentMoney < standardZombiePrice) // kill button and display greyed out button
        {
            buttonGroup.getAt(0).kill(); // standard zombie button
            standardZombieBankrupt.reset(40, 160);
        }
        else // kill the greyed out image and display the button again
        {
            buttonGroup.getAt(0).reset(40, 160);
            if(standardZombieBankrupt.alive)
                standardZombieBankrupt.kill();
        }
        // strong zombie button
        if(currentMoney < strongZombiePrice) // kill button and display greyed out button
        {
            buttonGroup.getAt(1).kill(); // strong zombie button
            strongZombieBankrupt.reset(40, 320);
        }
        else // kill the greyed out image and display the button again
        {
            buttonGroup.getAt(1).reset(40, 320);
            if(strongZombieBankrupt.alive)
                strongZombieBankrupt.kill();
        }
        // healing zombie button
        if(currentMoney < healingZombiePrice) // kill button and display greyed out button
        {
            buttonGroup.getAt(2).kill(); // healing zombie button
            healingZombieBankrupt.reset(40, 480);
        }
        else // kill the greyed out image and display the button again
        {
            buttonGroup.getAt(2).reset(40, 480);
            if(healingZombieBankrupt.alive)
                healingZombieBankrupt.kill();
        }
        // generations zombie button
        if(currentMoney < generationsZombiePrice) // kill button and display greyed out button
        {
            buttonGroup.getAt(3).kill(); // generations zombie button
            generationsZombieBankrupt.reset(40, 640);
        }
        else // kill the greyed out image and display the button again
        {
            buttonGroup.getAt(3).reset(40, 640);
            if(generationsZombieBankrupt.alive)
                generationsZombieBankrupt.kill();
        }
    }
    
    // defender check if user has enough money for tower purchases if not display bankrupt image
    
    
    
    bombTowerBankrupt;
    if(player.state == 'defender')
    {
        standardZombieBankrupt.reset(40, 160);
        strongZombieBankrupt.reset(40, 320);
        healingZombieBankrupt.reset(40, 480);
        generationsZombieBankrupt.reset(40, 640);
        
        var currentMoney = player.money;
        if(currentMoney < minigunTowerPrice)
        {
            buttonGroup.getAt(4).kill(); // minigun tower button
            minigunTowerBankrupt.reset(870, 160);
        }
        else
        {
            buttonGroup.getAt(4).reset(870, 160);
            if(minigunTowerBankrupt.alive)
                minigunTowerBankrupt.kill();
        }
        if(currentMoney < shotgunTowerPrice)
        {
            buttonGroup.getAt(5).kill(); // shotgun tower button
            shotgunTowerBankrupt.reset(870, 320);
        }
        else
        {
            buttonGroup.getAt(5).reset(870, 320);
            if(shotgunTowerBankrupt.alive)
                shotgunTowerBankrupt.kill();
        }
        if(currentMoney < gumTowerPrice)
        {
            buttonGroup.getAt(6).kill(); // gum tower button
            gumTowerBankrupt.reset(870, 480);
        }
        else
        {
            buttonGroup.getAt(6).reset(870, 480);
            if(gumTowerBankrupt.alive)
                gumTowerBankrupt.kill();
        }
        if(currentMoney < bombTowerPrice)
        {
            buttonGroup.getAt(7).kill(); // bomb tower button
            bombTowerBankrupt.reset(870, 640);
        }
        else
        {
            buttonGroup.getAt(7).reset(870, 640);
            if(bombTowerBankrupt.alive)
                bombTowerBankrupt.kill();
        }
    }
    
   // Change settings for every zombie elements
    if(state == 'attacker' && zombieStatArray.length > 0){
		if(zombieStatArray.length == (zombieArray.length-1)){
			zombieStatArray.push(new zombieStat(lane, spawn_x, spawn_y, 100, 1))
		}
		var message = JSON.stringify(zombieStatArray);

		socket.send(message);
    }
    
    // Applying tower attacks
    var withinRangeArray = []; // empty array now
    towerSize = 55; // width and height of towers. towersize / 2 = offset.
    offset = towerSize/2;
    
    // Going through every tower (one by one)
    for (var i=0; i< towerArray.length; i++) {
        withinRangeArray = [];

		// For every zombie and every tower, "overlap" of bullet+zombie will cause the damage
        for (var j=0; j< zombieArray.length; j++) {
			game.physics.arcade.overlap(towerBullets, zombieArray[j].image,
                function(zombie,bullet){ console.log("pre overlap");
					bullet.kill();
					zombieArray[j].hurt(towerArray[i].damage, j);
			}, null, this);
		}
		
		// If it's not ready for the tower to shoot, then skip the whole process for it
		if (game.time.now+30 < towerArray[i].nextFire) continue;

        var towerCenterX = parseInt(towerArray[i].pos_x) + parseInt(offset);
        var towerCenterY = parseInt(towerArray[i].pos_y) + parseInt(offset);
        
        // 1. Picking the zombies within range
        // I CAn USE DISTANCEBETWEEN FUNCTION TO GET CIRCULAR ATTACK RANGE
        for (var j=0; j< zombieArray.length; j++) {
			//game.debug.text("for loop ya",200,200);
            var leftRange   = towerCenterX - towerSize *2;
            var rightRange  = towerCenterX + towerSize *2;
            var topRange    = towerCenterY - towerSize *2;
            var bottomRange = towerCenterY + towerSize *2;

	    var zombieCenterX = zombieArray[j].image.x + 55;
  	    var zombieCenterY = zombieArray[j].image.y + 55;

            if (leftRange < zombieCenterX && zombieCenterX < rightRange &&
                topRange  < zombieCenterY && zombieCenterY < bottomRange) {
                
                withinRangeArray.push(j);
            }
        }
        
        if (withinRangeArray.length == 0) continue;

        // 2. Choosing the specific one to attack
        var frontIndex = withinRangeArray[0];
        for (var j=0; j< withinRangeArray.length; j++) {

            // placed ahead in terms of y-coordinate
            // Instead of having a zombie > frontZombie (then it crashes when they are on top of each other)
            if (zombieArray[withinRangeArray[j]].y - zombieArray[frontIndex].y > 1) {
                frontIndex = withinRangeArray[j];
            }
            
            // last x-value changing lane - as heading towards the base
            else if (zombieArray[withinRangeArray[j]].y == zombieArray[frontIndex].y && zombieArray[frontIndex].y >= 700) { // 700 IS NOT FIXED!!!
             
				// closer to the base in x value
				if (Math.abs(zombieArray[withinRangeArray[j]].y-485) < Math.abs(zombieArray[frontIndex].y-485)) { // 485 NOT FIXED!!
					frontIndex = withinRangeArray[j];
				}
			}
			
			// first x-value changing lane - as walking away from the zombie tombstone
			else if (zombieArray[withinRangeArray[j]].y == zombieArray[frontIndex].y && zombieArray[frontIndex].y <= 160) { // 160 IS NOT FIXED!!!

				// further from the zombie factory in x value
				if (Math.abs(zombieArray[frontIndex].y-485) < Math.abs(zombieArray[j].y-485)) { // 485 NOT FIXED!!
					frontIndex = withinRangeArray[j];
				}
			}
        }

        // 3. attack!
		towerArray[i].attack(zombieArray[frontIndex]);
		
    } // end of for-loop for towerArray
}
