// Color Cycling in HTML5 Canvas
// BlendShift Technology conceived, designed and coded by Joseph Huckaby
// Copyright (c) 2001-2002, 2010 Joseph Huckaby.
// Released under the LGPL v3.0: http://www.opensource.org/licenses/lgpl-3.0.html

FrameCount.visible = false;

//#region WallpaperEngine
var fpsInterval, now, then, elapsed;
var intervalID, selectedScene, randomEnabled, randomDelay;

window.wallpaperPropertyListener = {
	applyUserProperties: function (properties) {
		console.log("applyUserProperties", properties);

		// BACKGROUND
		if (properties.schemecolor) {
			// Convert the schemecolor to 0 - 255 range for CSS usage
			var customColor = properties.schemecolor.value.split(' ');
			customColor = customColor.map(function (c) {
				return Math.ceil(c * 255);
			});
			var customColorAsCSS = 'rgb(' + customColor + ')';
			
			console.log("schemecolor: " + customColorAsCSS);
			document.body.style.backgroundColor = customColorAsCSS;
		}

		// SPEED
		if (properties.speed) {
			console.log("speed: " + properties.speed.value);
			
			CC.setSpeed(properties.speed.value);
		}
		
		// FPS
		if (properties.fps) {
			console.log("fps: " + properties.fps.value);
			
			CC.settings.targetFPS = properties.fps.value;
		}
		
		// BLENDSHIFT
		if (properties.blend_shift) {
			console.log("blend_shift: " + properties.blend_shift.value);
			
			CC.settings.blendShiftEnabled = properties.blend_shift.value;
		}

		// STRETCH
		if (properties.stretch) {
			console.log("stretch: " + properties.stretch.value);

			CC.stretch = properties.stretch.value;
			CC.handleResize();
		}
		
		// SOUND
		if (properties.audio_enabled) {
			console.log("audio_enabled: " + properties.audio_enabled.value);
			
			if (properties.audio_enabled.value) {
				CC.settings.sound = true;
				CC.stopSceneAudio();
				CC.startSceneAudio();
			}
			else {
				CC.stopSceneAudio();
				CC.settings.sound = false;
			}
		}
		
		// VOLUME
		if (properties.audio_volume) {
			console.log("audio_volume: " + properties.audio_volume.value);
			
			CC.audioVolume = properties.audio_volume.value;
			CC.stopSceneAudio();
			CC.startSceneAudio();
		}

		// SCENE TRANSITION FADE
		if (properties.transition_fade) {
			console.log("transition_fade: " + properties.transition_fade.value);

			CC.settings.transitionFade = properties.transition_fade.value;
		}
		
		///////////
		// MODES //
		///////////
		
		// SCENE
		if (properties.sceneselect) {
			console.log("sceneselect: " + properties.sceneselect.value);
			
			CC.switchScene(properties.sceneselect.value);
			selectedScene = properties.sceneselect.value;
		}
		
		// RANDOM
		var randomScene = function () {
			var nextScene = 0;
			while (true) {
				nextScene = Math.floor(Math.random() * 35);
				if (nextScene != selectedScene && !CC.recentScenes.includes(nextScene)) {
					break;
				}
			}
			CC.switchScene(nextScene);
			CC.recentScenes.push(nextScene);
			if (CC.recentScenes.length > 10) {
				CC.recentScenes.shift();
			}
		};

		if (properties.random_mode) {
			console.log("random_mode: " + properties.random_mode.value);
			
			clearInterval(intervalID);
			CC.recentScenes = [];
		
			if (properties.random_mode.value) {
				randomEnabled = true;
				CC.switchScene(Math.floor(Math.random() * 35));
				intervalID = setInterval(randomScene, randomDelay * 1000 * 60);
			}
			else
			{
				randomEnabled = false;
				// switch back to selected scene
				console.log("switch back to " + selectedScene);
				CC.switchScene(selectedScene);
			}
		}
		
		// RANDOM DELAY
		if (properties.random_delay) {
			console.log("random_delay: " + properties.random_delay.value);
			
			randomDelay = properties.random_delay.value;
			if (randomEnabled) {
				clearInterval(intervalID);
				intervalID = setInterval(randomScene, randomDelay * 1000 * 60);
			}
		}
	}
};
//#endregion WallpaperEngine

var CanvasCycle = {
	
	cookie: new CookieTree(),
	ctx: null,
	imageData: null,
	clock: 0,
	inGame: false,
	bmp: null,
	globalTimeStart: (new Date()).getTime(),
	inited: false,
	optTween: null,
	winSize: null,
	globalBrightness: 1.0,
	lastBrightness: 0,
	sceneIdx: -1,
	highlightColor: -1,
	defaultMaxVolume: 0.5,
	
	audioVolume: 1,
	
	settings: {
		showOptions: false,
		targetFPS: 60,
		zoomFull: false,
		blendShiftEnabled: true,
		speedAdjust: 1.0,
		sound: false,
		transitionFade: false
	},

	contentSize: {
		width: 640,
		optionsWidth: 0,
		height: 480 + 40,
		scale: 1.0
	},

	init: function() {
		// called when DOM is ready
		if (!this.inited) {
			// for fps limiting
			then = Date.now();

			this.inited = true;
			$('container').style.display = 'block';
			$('d_options').style.display = 'none';
		
			FrameCount.init();
			this.handleResize();
		
			var pal_disp = $('palette_display');
			for (var idx = 0, len = 256; idx < len; idx++) {
				var div = document.createElement('div');
				div._idx = idx;
				div.id = 'pal_' + idx;
				div.className = 'palette_color';
				div.onmouseover = function() { CanvasCycle.highlightColor = this._idx; };
				div.onmouseout = function() { CanvasCycle.highlightColor = -1; };
				pal_disp.appendChild( div );
			}
			var div = document.createElement('div');
			div.className = 'clear';
			pal_disp.appendChild( div );
		
			// pick starting scene
			var initialSceneIdx = Math.floor( Math.random() * scenes.length );
			//var initialSceneIdx = 0;
			if (location.href.match(/\bscene\=(\d+)/)) {
				initialSceneIdx = parseInt(RegExp.$1, 10);
			}
			
			// populate scene menu
			var html = '';
			html += '<select id="fe_scene" onChange="CanvasCycle.switchScene(this)">';
			for (var idx = 0, len = scenes.length; idx < len; idx++) {
				var scene = scenes[idx];
				html += '<option value="'+scene.name+'" '+((idx == initialSceneIdx) ? ' selected="selected"' : '')+'>'+scene.title+'</option>';
			}
			html += '</select>';
			$('d_scene_selector').innerHTML = html;
			
			// read prefs from cookie
			var prefs = this.cookie.get('settings');
			if (prefs) {
				if (prefs.showOptions) this.toggleOptions();
				this.setRate( prefs.targetFPS );
				this.setZoom( prefs.zoomFull );
				this.setSpeed( prefs.speedAdjust );
				this.setBlendShift( prefs.blendShiftEnabled );
				this.setSound( prefs.sound );
			}
			
			// allow query to control sound
			if (location.href.match(/\bsound\=(\d+)/)) {
				this.setSound( !!parseInt(RegExp.$1, 10) );
			}
		
			this.loadImage( scenes[initialSceneIdx].name );
			this.sceneIdx = initialSceneIdx;


			// Set up the scene reset interval (every 2 hours)
			setInterval(() => {
				var randomSceneIdx = Math.floor(Math.random() * scenes.length);
				// Reset to the initial scene (or any other scene you want)
				this.switchScene(randomSceneIdx);
			},2 * 60 * 60 * 1000); // 2 hours in milliseconds
		}
			
	},

	jumpScene: function(dir) {
		// next or prev scene
		this.sceneIdx += dir;
		if (this.sceneIdx >= scenes.length) this.sceneIdx = 0;
		else if (this.sceneIdx < 0) this.sceneIdx = scenes.length - 1;
		$('fe_scene').selectedIndex = this.sceneIdx;
		this.switchScene( $('fe_scene') );
	},

	switchScene: function(menu) {
		// switch to new scene (grab menu selection)
		this.stopSceneAudio();
		
		//var name = menu.options[menu.selectedIndex].value;
		//this.sceneIdx = menu.selectedIndex;
		var name = scenes[menu].name;
		this.sceneIdx = menu;
		
		if (ua.mobile || !this.settings.transitionFade) {
			// no transitions on mobile devices, just switch as fast as possible
			this.inGame = false;
			
			this.ctx.clearRect(0, 0, this.bmp.width, this.bmp.height);
			this.ctx.fillStyle = "rgb(0,0,0)";
			this.ctx.fillRect(0, 0, this.bmp.width, this.bmp.height);
			
			CanvasCycle.globalBrightness = 1.0;
			CanvasCycle.loadImage( name );
		}
		else {
			TweenManager.removeAll({ category: 'scenefade' });
			TweenManager.tween({
				target: { value: this.globalBrightness, newSceneName: name },
				duration: Math.floor( this.settings.targetFPS / 2 ),
				mode: 'EaseInOut',
				algo: 'Quadratic',
				props: { value: 0.0 },
				onTweenUpdate: function(tween) {
					CanvasCycle.globalBrightness = tween.target.value;
				},
				onTweenComplete: function(tween) {
					CanvasCycle.loadImage( tween.target.newSceneName );
				},
				category: 'scenefade'
			});
		}
	},

	loadImage: function(name) {
		// load image JSON from the server
		this.stop();
		this.showLoading();
		
		var url = './images/'+name+'.LBM.js';
		var scr = document.createElement('SCRIPT');
		scr.type = 'text/javascript';
		scr.src = url;
		document.getElementsByTagName('HEAD')[0].appendChild(scr);
	},
	
	showLoading: function() {
		// show spinning loading indicator
		var loading = $('d_loading');
		loading.style.left = '' + Math.floor( ((this.contentSize.width * this.contentSize.scale) / 2) - 16 ) + 'px';
		loading.style.top = '' + Math.floor( ((this.contentSize.height * this.contentSize.scale) / 2) - 16 ) + 'px';
		//loading.show();
	},
	
	hideLoading: function() {
		// hide spinning loading indicator
		$('d_loading').hide();
	},

	processImage: function(img) {
		// initialize, receive image data from server
		this.bmp = new Bitmap(img);
		this.bmp.optimize();
	
		// $('d_debug').innerHTML = img.filename;
		
		var canvas = $('mycanvas');
		if (!canvas.getContext) return; // no canvas support
	
		if (!this.ctx) this.ctx = canvas.getContext('2d');
		this.ctx.clearRect(0, 0, this.bmp.width, this.bmp.height);
		this.ctx.fillStyle = "rgb(0,0,0)";
		this.ctx.fillRect (0, 0, this.bmp.width, this.bmp.height);
	
		if (!this.imageData) {
			if (this.ctx.createImageData) {
				this.imageData = this.ctx.createImageData( this.bmp.width, this.bmp.height );
			}
			else if (this.ctx.getImageData) {
				this.imageData = this.ctx.getImageData( 0, 0, this.bmp.width, this.bmp.height );
			}
			else return; // no canvas data support
		}
		
		if (ua.mobile || !this.settings.transitionFade) {
			// no transition on mobile devices
			this.globalBrightness = 1.0;
		}
		else {
			this.globalBrightness = 0.0;
			TweenManager.removeAll({ category: 'scenefade' });
			TweenManager.tween({
				target: { value: 0 },
				duration: Math.floor( this.settings.targetFPS / 2 ),
				mode: 'EaseInOut',
				algo: 'Quadratic',
				props: { value: 1.0 },
				onTweenUpdate: function(tween) {
					CanvasCycle.globalBrightness = tween.target.value;
				},
				category: 'scenefade'
			});
		}
		
		this.startSceneAudio();
	},
	
	run: function () {
		// start main loop
		if (!this.inGame) {
			this.inGame = true;
			this.animate();
		}
	},
	
	stop: function() {
		// stop main loop
		this.inGame = false;
	},

	animate: function() {
		//#region limit fps
		fpsInterval = 1000 / this.settings.targetFPS;
		now = Date.now();
		elapsed = now - then;
		requestAnimationFrame( function() { CanvasCycle.animate(); });

		if (elapsed > fpsInterval) {
			then = now - (elapsed % fpsInterval);
			//#endregion limit fps

			// animate one frame. and schedule next
			if (this.inGame) {
				var colors = this.bmp.palette.colors;
				if (this.settings.showOptions) {
					for (var idx = 0, len = colors.length; idx < len; idx++) {
						var clr = colors[idx];
						var div = $('pal_'+idx);
						div.style.backgroundColor = 'rgb(' + clr.red + ',' + clr.green + ',' + clr.blue + ')';
					}
			
					// if (this.clock % this.settings.targetFPS == 0) $('d_debug').innerHTML = 'FPS: ' + FrameCount.current;
					$('d_debug').innerHTML = 'FPS: ' + FrameCount.current + ((this.highlightColor != -1) ? (' - Color #' + this.highlightColor) : '');
				}
		
				this.bmp.palette.cycle( this.bmp.palette.baseColors, GetTickCount(), this.settings.speedAdjust, this.settings.blendShiftEnabled );
				if (this.highlightColor > -1) {
					this.bmp.palette.colors[ this.highlightColor ] = new Color(255, 255, 255);
				}
				if (this.globalBrightness < 1.0) {
					// bmp.palette.fadeToColor( pureBlack, 1.0 - globalBrightness, 1.0 );
					this.bmp.palette.burnOut( 1.0 - this.globalBrightness, 1.0 );
				}
				this.bmp.render( this.imageData, (this.lastBrightness == this.globalBrightness) && (this.highlightColor == this.lastHighlightColor) );
				this.lastBrightness = this.globalBrightness;
				this.lastHighlightColor = this.highlightColor;
		
				this.ctx.putImageData( this.imageData, 0, 0 );
		
				TweenManager.logic( this.clock );
				this.clock++;
				FrameCount.count();
				this.scaleAnimate();
				//if (this.inGame) {
					// setTimeout( function() { CanvasCycle.animate(); }, 1 );
					//requestAnimationFrame( function() { CanvasCycle.animate(); } );
				//}
			}
		
		}
	},

	scaleAnimate: function() {
		// handle scaling image up or down
		if (this.settings.zoomFull) {
			// scale up to full size
			var totalNativeWidth = this.contentSize.width + this.contentSize.optionsWidth;
			var maxScaleX = (this.winSize.width - 30) / totalNativeWidth;
		
			var totalNativeHeight = this.contentSize.height;
			var maxScaleY = (this.winSize.height - 30) / totalNativeHeight;
		
			var maxScale = Math.min( maxScaleX, maxScaleY );
		
			if (this.contentSize.scale != maxScale) {
				this.contentSize.scale += ((maxScale - this.contentSize.scale) / 8);
				if (Math.abs(this.contentSize.scale - maxScale) < 0.001) this.contentSize.scale = maxScale; // close enough
			
				var sty = $('mycanvas').style; 
			
				if (ua.webkit) sty.webkitTransform = 'translate3d(0px, 0px, 0px) scale('+this.contentSize.scale+')';
				else if (ua.ff) sty.MozTransform = 'scale('+this.contentSize.scale+')';
				else if (ua.op) sty.OTransform = 'scale('+this.contentSize.scale+')';
				else sty.transform = 'scale('+this.contentSize.scale+')';
				
				sty.marginRight = '' + Math.floor( (this.contentSize.width * this.contentSize.scale) - this.contentSize.width ) + 'px';
				$('d_header').style.width = '' + Math.floor(this.contentSize.width * this.contentSize.scale) + 'px';
				this.repositionContainer();
			}
		}
		else {
			// scale back down to native
			if (this.contentSize.scale > 1.0) {
				this.contentSize.scale += ((1.0 - this.contentSize.scale) / 8);
				if (this.contentSize.scale < 1.001) this.contentSize.scale = 1.0; // close enough
			
				var sty = $('mycanvas').style; 
			
				if (ua.webkit) sty.webkitTransform = 'translate3d(0px, 0px, 0px) scale('+this.contentSize.scale+')';
				else if (ua.ff) sty.MozTransform = 'scale('+this.contentSize.scale+')';
				else if (ua.op) sty.OTransform = 'scale('+this.contentSize.scale+')';
				else sty.transform = 'scale('+this.contentSize.scale+')';
				
				sty.marginRight = '' + Math.floor( (this.contentSize.width * this.contentSize.scale) - this.contentSize.width ) + 'px';
				$('d_header').style.width = '' + Math.floor(this.contentSize.width * this.contentSize.scale) + 'px';
				this.repositionContainer();
			}
		}
	},
	
	repositionContainer: function() {
		// reposition container element based on inner window size
		// return;
		var div = $('container');
		if (div) {
			this.winSize = getInnerWindowSize();
			//div.style.left = '' + Math.floor((this.winSize.width / 2) - (((this.contentSize.width * this.contentSize.scale) + this.contentSize.optionsWidth) / 2)) + 'px';
			//div.style.top = '' + Math.floor((this.winSize.height / 2) - ((this.contentSize.height * this.contentSize.scale) / 2)) + 'px';			
		}
	},

	handleResize: function() {

		if (this.settings.zoomFull) this.scaleAnimate();
	
		// custom scale logic
		var canvas = document.getElementById('container');
		var width = window.innerWidth;
		var height = window.innerHeight;
	
		// Set canvas to full screen size
		canvas.width = width;
		canvas.height = height;
	
		// Adjust the content size to match the new canvas size
		this.contentSize.width = width;
		this.contentSize.height = height;
		
		/*
		// called when window resizes
		this.repositionContainer();
		
		if (this.settings.zoomFull) this.scaleAnimate();

		// custom scale logic
		var canvas = document.getElementById('mycanvas');
		var ratio = 640 / 480;
		var width = window.innerWidth;
		var height = window.innerHeight;

		if (this.stretch === 'horizontal') {
			// set the width of the canvas to match the height (multiplied by the ratio)
			canvas.style.height = width / ratio + 'px';
			canvas.style.width = width + 'px';
		} 
		else if (this.stretch === 'vertical') {
			// set the height of the canvas to match the width (divided by the ratio)
			canvas.style.width = height * ratio + 'px';
			canvas.style.height = height + 'px';
		}
		else if (this.stretch === 'fill') {
			// et the canvas to the window size
			canvas.style.width = width + 'px';
			canvas.style.height = height + 'px';
		}
		else {
			// default resolution
			canvas.style.width = '640px';
			canvas.style.height = '480px';
		}
		*/
	},
	
	saveSettings: function() {
		// save settings in cookie
		this.cookie.set( 'settings', this.settings );
		this.cookie.save();
	},
	
	startSceneAudio: function() {
		// start audio for current scene, if applicable
		var scene = scenes[ this.sceneIdx ];
		if (scene.sound && this.settings.sound && window.Audio) {
			if (this.audioTrack) {
				try { this.audioTrack.pause(); } catch(e) {;}
			}
			TweenManager.removeAll({ category: 'audio' });
			
			//var ext = (ua.ff || ua.op) ? 'ogg' : 'mp3';
			var ext = 'mp3';
			var track = this.audioTrack = new Audio( 'audio/' + scene.sound + '.' + ext );
			track.volume = 0;
			track.loop = true;
			track.autobuffer = false;
			track.autoplay = true;
			
			track.addEventListener('canplaythrough', function() {
				track.play();
				TweenManager.tween({
					target: track,
					duration: Math.floor( CanvasCycle.settings.targetFPS * 2 ),
					mode: 'EaseOut',
					algo: 'Linear',
					props: { volume: scene.maxVolume * CC.audioVolume || CanvasCycle.defaultMaxVolume * CC.audioVolume },
					category: 'audio'
				});
				CanvasCycle.hideLoading();
				CanvasCycle.run();
			}, false);
			
			track.load();
		} // sound enabled and supported
		else {
			// no sound for whatever reason, so just start main loop
			this.hideLoading();
			this.run();
		}
	},
	
	stopSceneAudio: function() {
		// fade out and stop audio for current scene
		var scene = scenes[ this.sceneIdx ];
		if (scene.sound && this.settings.sound && window.Audio && this.audioTrack) {
			var track = this.audioTrack;
			
			if (ua.iphone || ua.ipad) {
				// no transition here, so just stop sound
				track.pause();
			}
			else {
				TweenManager.removeAll({ category: 'audio' });
				TweenManager.tween({
					target: track,
					duration: Math.floor( CanvasCycle.settings.targetFPS / 2 ),
					mode: 'EaseOut',
					algo: 'Linear',
					props: { volume: 0 },
					onTweenComplete: function(tween) {
						// ff has weird delay with volume fades, so allow sound to continue
						// will be stopped when next one starts
						if (!ua.ff) track.pause();
					},
					category: 'audio'
				});
			}
		}
	},

	toggleOptions: function() {
		var startValue, endValue;
		TweenManager.removeAll({ category: 'options' });
	
		if (!this.settings.showOptions) {
			startValue = 0;
			if (this.optTween) startValue = this.optTween.target.value;
			endValue = 1.0;
			$('d_options').style.display = 'none';
			$('d_options').style.opacity = startValue;
			$('btn_options_toggle').innerHTML = '&#x00AB; Hide Options';
		}
		else {
			startValue = 1.0;
			if (this.optTween) startValue = this.optTween.target.value;
			endValue = 0;
			$('btn_options_toggle').innerHTML = 'Show Options &#x00BB;';
		}
	
		this.optTween = TweenManager.tween({
			target: { value: startValue },
			duration: Math.floor( this.settings.targetFPS / 3 ),
			mode: 'EaseOut',
			algo: 'Quadratic',
			props: { value: endValue },
			onTweenUpdate: function(tween) {
				// $('d_options').style.left = '' + Math.floor(tween.target.value - 150) + 'px';
				$('d_options').style.opacity = tween.target.value;
				$('btn_options_toggle').style.left = '' + Math.floor(tween.target.value * 128) + 'px';
			
				CanvasCycle.contentSize.optionsWidth = Math.floor( tween.target.value * 150 );
				CanvasCycle.handleResize();
			},
			onTweenComplete: function(tween) {
				if (tween.target.value == 0) $('d_options').style.display = 'none';
				CanvasCycle.optTween = null;
			},
			category: 'options'
		});
	
		this.settings.showOptions = !this.settings.showOptions;
		this.saveSettings();
	},

	setZoom: function(enabled) {
		if (enabled != this.settings.zoomFull) {
			this.settings.zoomFull = enabled;
			this.saveSettings();
			$('btn_zoom_actual').setClass('selected', !enabled);
			$('btn_zoom_max').setClass('selected', enabled);
		}
	},

	setSound: function(enabled) {
		$('btn_sound_on').setClass('selected', enabled);
		$('btn_sound_off').setClass('selected', !enabled);
		this.settings.sound = enabled;
		
		if (this.sceneIdx > -1) {
			if (enabled) {
				// enable sound
				if (this.audioTrack) this.audioTrack.play();
				else this.startSceneAudio();
			}
			else {
				// disable sound
				if (this.audioTrack) this.audioTrack.pause();
			}
		}
		
		this.saveSettings();
	},

	setRate: function(rate) {
		/* $('btn_rate_30').setClass('selected', rate == 30);
		$('btn_rate_60').setClass('selected', rate == 60);
		$('btn_rate_90').setClass('selected', rate == 90); */
		this.settings.targetFPS = rate;
		this.saveSettings();
	},
	
	setSpeed: function(speed) {
		$('btn_speed_025').setClass('selected', speed == 0.25);
		$('btn_speed_05').setClass('selected', speed == 0.5);
		$('btn_speed_1').setClass('selected', speed == 1);
		$('btn_speed_2').setClass('selected', speed == 2);
		$('btn_speed_4').setClass('selected', speed == 4);
		this.settings.speedAdjust = speed;
		this.saveSettings();
	},

	setBlendShift: function(enabled) {
		$('btn_blendshift_on').setClass('selected', enabled);
		$('btn_blendshift_off').setClass('selected', !enabled);
		this.settings.blendShiftEnabled = enabled;
		this.saveSettings();
	}

};

var CC = CanvasCycle; // shortcut

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller
// fixes from Paul Irish and Tino Zijdel

(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());
