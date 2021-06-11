// We make use of this 'server' variable to provide the address of the
// REST Janus API. By default, in this example we assume that Janus is
// co-located with the web server hosting the HTML pages but listening
// on a different port (8088, the default for HTTP in Janus), which is
// why we make use of the 'window.location.hostname' base address. Since
// Janus can also do HTTPS, and considering we don't really want to make
// use of HTTP for Janus if your demos are served on HTTPS, we also rely
// on the 'window.location.protocol' prefix to build the variable, in
// particular to also change the port used to contact Janus (8088 for
// HTTP and 8089 for HTTPS, if enabled).
// In case you place Janus behind an Apache frontend (as we did on the
// online demos at http://janus.conf.meetecho.com) you can just use a
// relative path for the variable, e.g.:
//
// 		var server = "/janus";
//
// which will take care of this on its own.
//
//
// If you want to use the WebSockets frontend to Janus, instead, you'll
// have to pass a different kind of address, e.g.:
//
// 		var server = "ws://" + window.location.hostname + ":8188";
//
// Of course this assumes that support for WebSockets has been built in
// when compiling the server. WebSockets support has not been tested
// as much as the REST API, so handle with care!
//
//
// If you have multiple options available, and want to let the library
// autodetect the best way to contact your server (or pool of servers),
// you can also pass an array of servers, e.g., to provide alternative
// means of access (e.g., try WebSockets first and, if that fails, fall
// back to plain HTTP) or just have failover servers:
//
//		var server = [
//			"ws://" + window.location.hostname + ":8188",
//			"/janus"
//		];
//
// This will tell the library to try connecting to each of the servers
// in the presented order. The first working server will be used for
// the whole session.
//


//Adding Code For SignalR
var liveConnectionId = null;
var viewerCount = 0;
var streamingServers = null;
var randomPort1 = null;
var randomPort2 = null;
var janus_instance_local_ip;
var frontCam = null;
var backCam = null;
var camSelected = null;
var cams = [];
var recordLive = null;
const connection = new signalR.HubConnectionBuilder()
	//.withUrl("https://localhost:44331/live")
	.configureLogging(signalR.LogLevel.Debug)
	.build();

async function start() {
	try {
		await connection.start();
		console.log("SignalR Connected");
		const hubConnectionId = await connection.invoke("GetConnectionId");
		liveConnectionId = hubConnectionId;
		streamingServers = await connection.invoke("GetStreamingServers");
		console.log("Hub Connection Established with Id: " + hubConnectionId);
		janus_instance_local_ip = await connection.invoke("SelectServer");
		console.log("Connecting to Server: " + janus_instance_local_ip);

		$.holdReady(false);

	} catch (err) {
		console.log(err);
		setTimeout(start, 5000);
	}
};
//

start();
$.holdReady(true);

var janus = null;
var sfutest = null;
var opaqueId = "videoroomtest-" + Janus.randomString(12);
var myroom = null;	// Will generate automatically.
if (getQueryStringValue("room") !== "")
	myroom = parseInt(getQueryStringValue("room"));

var myusername = null;
var myid = null;
var mystream = null;
// We use this other ID just to map our subscriptions to us
var mypvtid = null;

var feeds = [];
var bitrateTimer = [];
var doSimulcast = (getQueryStringValue("simulcast") === "yes" || getQueryStringValue("simulcast") === "true");
var doSimulcast2 = (getQueryStringValue("simulcast2") === "yes" || getQueryStringValue("simulcast2") === "true");
var subscriber_mode = (getQueryStringValue("subscriber-mode") === "yes" || getQueryStringValue("subscriber-mode") === "true");

//Store Recording Handles.
var recordHandles = [];


$(document).ready(function () {

	var server = null;
	if (window.location.protocol === 'http:')
		server = "http://" + janus_instance_local_ip + ":8088/janus";
	else
		server = "https://" + janus_instance_local_ip + ":8089/janus";


	// Initialize the library (all console debuggers enabled)
	Janus.init({
		debug: "all", callback: function () {
			// Use a button to start the demo
			$('#start').one('click', function () {
				$(this).attr('disabled', true).unbind('click');
				// Make sure the browser supports WebRTC
				if (!Janus.isWebrtcSupported()) {
					bootbox.alert("No WebRTC support... ");
					return;
				}
				// Create session
				janus = new Janus(
					{
						server: server,
						success: function () {
							// Attach to VideoRoom plugin
							janus.attach(
								{
									plugin: "janus.plugin.videoroom",
									opaqueId: opaqueId,
									success: function (pluginHandle) {
										$('#details').remove();
										sfutest = pluginHandle;
										Janus.log("Plugin attached! (" + sfutest.getPlugin() + ", id=" + sfutest.getId() + ")");
										Janus.log("  -- This is a publisher/manager");
										// Prepare the username registration
										$('#videojoin').removeClass('hide').show();
										$('#registernow').removeClass('hide').show();
										$('#register').click(registerUsername);
										$('#username').focus();

										//List Devices:
										Janus.listDevices(initDevices);
										
										//For MountPoint Destruction On Live Stop
										$('#start').removeAttr('disabled').html("Stop")
											.click(function () {
												$(this).attr('disabled', true);
												stoplive();
												janus.destroy();
											});
									
									},
									error: function (error) {
										Janus.error("  -- Error attaching plugin...", error);
										bootbox.alert("Error attaching plugin... " + error);
									},
									consentDialog: function (on) {
										Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
										if (on) {
											// Darken screen and show hint
											$.blockUI({
												message: '<div><img src="up_arrow.png"/></div>',
												css: {
													border: 'none',
													padding: '15px',
													backgroundColor: 'transparent',
													color: '#aaa',
													top: '10px',
													left: (navigator.mozGetUserMedia ? '-100px' : '300px')
												}
											});
										} else {
											// Restore screen
											$.unblockUI();
										}
									},
									iceState: function (state) {
										Janus.log("ICE state changed to " + state);
									},
									mediaState: function (medium, on) {
										Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
										if(on && medium === "video")
										{
											recordHandles.forEach(recordHandle=>{
												startRecording(recordHandle);
											});
										}
									},
									webrtcState: function (on) {
										Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
										$("#videolocal").parent().parent().unblock();
										if (!on)
											return;
										$('#publish').remove();
										// This controls allows us to override the global room bitrate cap
										$('#bitrate').parent().parent().removeClass('hide').show();
										$('#bitrate a').click(function () {
											var id = $(this).attr("id");
											var bitrate = parseInt(id) * 1000;
											if (bitrate === 0) {
												Janus.log("Not limiting bandwidth via REMB");
											} else {
												Janus.log("Capping bandwidth to " + bitrate + " via REMB");
											}
											$('#bitrateset').html($(this).html() + '<span class="caret"></span>').parent().removeClass('open');
											sfutest.send({ message: { request: "configure", bitrate: bitrate } });
											return false;
										});

									},
									onmessage: function (msg, jsep) {
										Janus.debug(" ::: Got a message (publisher) :::", msg);
										var event = msg["videoroom"];
										Janus.debug("Event: " + event);
										if (event) {
											if (event === "joined") {
												// Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
												myid = msg["id"];
												mypvtid = msg["private_id"];
												Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
												if (subscriber_mode) {
													$('#videojoin').hide();
													$('#videos').removeClass('hide').show();
												} else {
													publishOwnFeed(true);
												}
												// Any new feed to attach to?
												if (msg["publishers"]) {
													var list = msg["publishers"];
													Janus.debug("Got a list of available publishers/feeds:", list);
													for (var f in list) {
														var id = list[f]["id"];
														var display = list[f]["display"];
														var audio = list[f]["audio_codec"];
														var video = list[f]["video_codec"];
														Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
														newRemoteFeed(id, display, audio, video);
													}
												}
											} else if (event === "destroyed") {
												// The room has been destroyed
												Janus.warn("The room has been destroyed!");
												bootbox.alert("The room has been destroyed", function () {
													window.location.reload();
												});
											} else if (event === "event") {
												// Any new feed to attach to?
												if (msg["publishers"]) {
													var list = msg["publishers"];
													Janus.debug("Got a list of available publishers/feeds:", list);
													for (var f in list) {
														var id = list[f]["id"];
														var display = list[f]["display"];
														var audio = list[f]["audio_codec"];
														var video = list[f]["video_codec"];
														Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
														newRemoteFeed(id, display, audio, video);
													}
												} else if (msg["leaving"]) {
													// One of the publishers has gone away?
													var leaving = msg["leaving"];
													Janus.log("Publisher left: " + leaving);
													var remoteFeed = null;
													for (var i = 1; i < 6; i++) {
														if (feeds[i] && feeds[i].rfid == leaving) {
															remoteFeed = feeds[i];
															break;
														}
													}
													if (remoteFeed != null) {
														Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
														$('#remote' + remoteFeed.rfindex).empty().hide();
														$('#videoremote' + remoteFeed.rfindex).empty();
														feeds[remoteFeed.rfindex] = null;
														remoteFeed.detach();
													}
												} else if (msg["unpublished"]) {
													// One of the publishers has unpublished?
													var unpublished = msg["unpublished"];
													Janus.log("Publisher left: " + unpublished);
													if (unpublished === 'ok') {
														// That's us
														sfutest.hangup();
														return;
													}
													var remoteFeed = null;
													for (var i = 1; i < 6; i++) {
														if (feeds[i] && feeds[i].rfid == unpublished) {
															remoteFeed = feeds[i];
															break;
														}
													}
													if (remoteFeed != null) {
														Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
														$('#remote' + remoteFeed.rfindex).empty().hide();
														$('#videoremote' + remoteFeed.rfindex).empty();
														feeds[remoteFeed.rfindex] = null;
														remoteFeed.detach();
													}
												} else if (msg["error"]) {
													if (msg["error_code"] === 426) {
														// This is a "no such room" error: give a more meaningful description
														bootbox.alert(
															"<p>Apparently room <code>" + myroom + "</code> (the one this demo uses as a test room) " +
															"does not exist...</p><p>Do you have an updated <code>janus.plugin.videoroom.jcfg</code> " +
															"configuration file? If not, make sure you copy the details of room <code>" + myroom + "</code> " +
															"from that sample in your current configuration file, then restart Janus and try again."
														);
													} else {
														bootbox.alert(msg["error"]);
													}
												}
											}
										}
										if (jsep) {
											Janus.debug("Handling SDP as well...", jsep);
											sfutest.handleRemoteJsep({ jsep: jsep });
											// Check if any of the media we wanted to publish has
											// been rejected (e.g., wrong or unsupported codec)
											var audio = msg["audio_codec"];
											if (mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
												// Audio has been rejected
												toastr.warning("Our audio stream has been rejected, viewers won't hear us");
											}
											var video = msg["video_codec"];
											if (mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
												// Video has been rejected
												toastr.warning("Our video stream has been rejected, viewers won't see us");
												// Hide the webcam video
												$('#myvideo').hide();
												$('#videolocal').append(
													'<div class="no-video-container">' +
													'<i class="fa fa-video-camera fa-5 no-video-icon" style="height: 100%;"></i>' +
													'<span class="no-video-text" style="font-size: 16px;">Video rejected, no webcam</span>' +
													'</div>');
											}
										}
									},
									onlocalstream: function (stream) {
										Janus.debug(" ::: Got a local stream :::", stream);
										mystream = stream;
										$('#videojoin').hide();
										$('#videos').removeClass('hide').show();
										if ($('#myvideo').length === 0) {
											$('#videolocal').append('<video class="rounded centered" id="myvideo" width="100%" height="100%" autoplay playsinline muted="muted"/>');
											// Add a 'mute' button
											$('#videolocal').append('<button class="btn btn-warning btn-xs" id="mute" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;">Mute</button>');
											$('#mute').click(toggleMute);
											// Add an 'unpublish' button
											$('#videolocal').append('<button class="btn btn-warning btn-xs" id="unpublish" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;">Unpublish</button>');
											$('#unpublish').click(unpublishOwnFeed);
										}
										$('#publisher').removeClass('hide').html(myusername).show();
										Janus.attachMediaStream($('#myvideo').get(0), stream);
										$("#myvideo").get(0).muted = "muted";
										if (sfutest.webrtcStuff.pc.iceConnectionState !== "completed" &&
											sfutest.webrtcStuff.pc.iceConnectionState !== "connected") {
											$("#videolocal").parent().parent().block({
												message: '<b>Publishing...</b>',
												css: {
													border: 'none',
													backgroundColor: 'transparent',
													color: 'white'
												}
											});

										}
										var videoTracks = stream.getVideoTracks();
										if (!videoTracks || videoTracks.length === 0) {
											// No webcam
											$('#myvideo').hide();
											if ($('#videolocal .no-video-container').length === 0) {
												$('#videolocal').append(
													'<div class="no-video-container">' +
													'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
													'<span class="no-video-text">No webcam available</span>' +
													'</div>');
											}
										} else {
											$('#videolocal .no-video-container').remove();
											$('#myvideo').removeClass('hide').show();

										}
									},
									onremotestream: function (stream) {
										// The publisher stream is sendonly, we don't expect anything here
									},
									oncleanup: function () {
										Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
										mystream = null;
										$('#videolocal').html('<button id="publish" class="btn btn-primary">Publish</button>');
										$('#publish').click(function () { publishOwnFeed(true); });
										$("#videolocal").parent().parent().unblock();
										$('#bitrate').parent().parent().addClass('hide');
										$('#bitrate a').unbind('click');
									}
								});
						},
						error: function (error) {
							Janus.error(error);
							bootbox.alert(error, function () {
								window.location.reload();
							});
						},
						destroyed: function () {
							window.location.reload();
						},
					});
			});
		}
	});
});


//Adding Code For Camera Selection

function initDevices(devices) {

	devices.forEach(function(device) {
		
		if(device.kind === 'videoinput')
		{
			cams.push(device.deviceId);
		}
	});
	console.log(cams);
	frontCam = cams[0];
	camSelected = frontCam;
	
	//Check if more than 1 camera
	if(cams.length > 1)
	{
		backCam = cams[1];
		$('#change-devices').click(function() {
			switchCamera();
		});

	}
	else{
		$('#change-devices').click(function() {
			alert("You only have 1 camera");
		});
	}
}

function switchCamera(){

	if(camSelected === frontCam)
	{
		camSelected = backCam;
	}
	else{
		camSelected = frontCam;
	}

	sfutest.createOffer(
		{
			media: {
				video: {
					deviceId: camSelected
				},
				replaceVideo: true
			},
			success: function(jsep) {
				Janus.debug(jsep);
				sfutest.send({message: {
					audio: true, 
					video: true, 
					"request" : "exists",
					"room" : myroom}, "jsep": jsep});
			},
			error: function(error) {
				bootbox.alert("WebRTC error... " + JSON.stringify(error));
			}
		});
		

	recordHandles.forEach(recordhandle=>{
		recordhandle.createOffer(
			{
				media: {
					video: {
						deviceId: camSelected
					},
					replaceVideo: true
				},
				success: function (jsep) {
					Janus.debug(jsep);
					recordhandle.send({
						message: {
							audio: true,
							video: true,
							"request": "list",
						}, "jsep": jsep
					});
				},
				error: function (error) {
					bootbox.alert("WebRTC error... " + JSON.stringify(error));
				}
			});
	});
}


function checkEnter(field, event) {
	var theCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;
	if (theCode == 13) {
		registerUsername();
		return false;
	} else {
		return true;
	}
}


function registerUsername() {
	if ($('#username').length === 0) {
		// Create fields to register
		$('#register').click(registerUsername);
		$('#username').focus();
	} else {
		// Try a registration
		$('#username').attr('disabled', true);
		$('#register').attr('disabled', true).unbind('click');
		var username = $('#username').val();
		if (username === "") {
			$('#you')
				.removeClass().addClass('label label-warning')
				.html("Insert your display name (e.g., pippo)");
			$('#username').removeAttr('disabled');
			$('#register').removeAttr('disabled').click(registerUsername);
			return;
		}
		if (/[^a-zA-Z0-9]/.test(username)) {
			$('#you')
				.removeClass().addClass('label label-warning')
				.html('Input is not alphanumeric');
			$('#username').removeAttr('disabled').val("");
			$('#register').removeAttr('disabled').click(registerUsername);
			return;
		}

		//Calling function to Create a New Room for Live User
		recordLive = $('#recordstream').is(":checked");
		console.log("User want to record stream " + recordLive);
		myusername = username;
		createNewRoom(username);
		//
	}
}


//Function to dynamically add new Live room to server
function createNewRoom(username) {

	var newroom = {
		"request": "create",
		"permanent": false,
		"publishers": 1,
		"bitrate": 512000,
		"fir_freq": 10,
		"audiocodec": "opus",
		"videocodec": "vp8",
		"record" :false,
		"videoorient_ext": false //IOS Screen Orientation Bug-fix.
	}

	sfutest.send({
		message: newroom,
		success: function (result) {
			if (result['room'] != null) {
				myroom = result['room'];
				console.log("Room Created with ID: " + myroom);

				var register = {
					request: "join",
					room: myroom,
					ptype: "publisher",
					display: username
				};
				sfutest.send({ message: register });

			}
			//Calling Hub's Start Live Method
			try {
				connection.invoke("StartLive", username, liveConnectionId, myroom);
				console.log("Live Started!");
				//Create Streaming Mountpoints MountPoints on All Available Servers
				createStreams(streamingServers);

				if(recordLive)
				{
					createRecordings(streamingServers);
				}
			} catch (err) {
				console.error(err);
			}
		}
	});
}


function createStreams(serverList) {
	if (serverList != null) {

		serverList.forEach(streamingServer => {

			var mountpoint = "https://" + streamingServer.serverIp + ":8089/janus";
			var janus = null;
			var streaming = null;
			var opaqueId = "streamingtest-" + Janus.randomString(12);
			janus = new Janus(
				{
					server: mountpoint,
					success: function () {
						janus.attach(
							{
								plugin: "janus.plugin.streaming",
								opaqueId: opaqueId,
								success: function (pluginHandle) {
									streaming = pluginHandle;
									Janus.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");


									//Creating Stream
									var audioPort = streamingServer.audioPort;
									var videoPort = streamingServer.videoPort;
									var hostIp = streamingServer.serverIp;

									//Create a New Stream
									var newStream = {
										"request": "create",
										"type": "rtp",
										"name": myusername,
										"secret": "adminpwd",
										"videortpmap": "VP8/90000",
										"videopt": 100,
										"audiortpmap": "opus/48000/2",
										"audiopt": 111,
										"audio": true,
										"video": true,
										"metadata": liveConnectionId,
										"description": myusername + " is Live!",
										"audioport": audioPort,
										"videoport": videoPort

									}

									streaming.send({
										message: newStream,
										success: function (result) {

											console.log("New Stream Created!" + JSON.stringify(result));
											//IMPORTANT - Send Streaming Data To Live Person to Create RTP Forwarder
											var streamDetails = result['stream'];
											connection.invoke("SendRtpPorts", liveConnectionId, hostIp, audioPort, videoPort, streamDetails['id']);

											//Inform Other of Live
											connection.invoke("NewLive");
											janus.destroy();

										}
									});

								},
								error: function (error) {
									Janus.error("  -- Error attaching plugin... ", error);
									bootbox.alert("Error attaching plugin... " + error);
								}
							}
						);
						
					}
				});
		});

	}
}

function createRecordings(serverList){
	if(recordLive){
		if (serverList != null) {
			serverList.forEach(streamingServer => {

				var mountpoint = "https://" + streamingServer.serverIp + ":8089/janus";
				var janus = null;
				var opaqueIdR = "recordplaytest-"+Janus.randomString(12);
				var recordplay = null;
				var bandwidth = 1024 * 1024;
				var recordingId = null;

				janus = new Janus(
					{
						server: mountpoint,
						success: function () {	
							janus.attach(
								{
									plugin: "janus.plugin.recordplay",
									opaqueId: opaqueIdR,
									success: function(pluginHandle) {
										recordplay = pluginHandle;
										Janus.log("Plugin attached! (" + recordplay.getPlugin() + ", id=" + recordplay.getId() + ")");
										// To start recording
										recordHandles.push(recordplay);
									},
									error: function(error) {
										Janus.error("  -- Error attaching plugin...", error);
										bootbox.alert("  -- Error attaching plugin... " + error);
									},
									onmessage: function(msg, jsep) {
										Janus.debug(" ::: Got a message :::", msg);
										var result = msg["result"];
										if(result) {
											if(result["status"]) {
												var event = result["status"];
												if(event === 'preparing' || event === 'refreshing') {
													Janus.log("Preparing the recording playout");
													recordplay.createAnswer(
														{
															jsep: jsep,
															media: { audioSend: false, videoSend: false, data: true },	// We want recvonly audio/video
															success: function(jsep) {
																Janus.debug("Got SDP!", jsep);
																var body = { request: "start" };
																recordplay.send({ message: body, jsep: jsep });
															},
															error: function(error) {
																Janus.error("WebRTC error:", error);
																bootbox.alert("WebRTC error... " + error.message);
															}
														});
													if(result["warning"])
														bootbox.alert(result["warning"]);
												} 
												else if(event === 'recording') {
													// Got an ANSWER to our recording OFFER
													if(jsep)
														recordplay.handleRemoteJsep({ jsep: jsep });
													var id = result["id"];
													if(id) {
														Janus.log("The ID of the current recording is " + id);
														recordingId = id;
													}
												} else if(event === 'slow_link') {
													var uplink = result["uplink"];
													if(uplink !== 0) {
														// Janus detected issues when receiving our media, let's slow down
														bandwidth = parseInt(bandwidth / 1.5);
														recordplay.send({
															message: {
																request: 'configure',
																'video-bitrate-max': bandwidth,		// Reduce the bitrate
																'video-keyframe-interval': 15000	// Keep the 15 seconds key frame interval
															}
														});
													}
												} else if(event === 'playing') {
													Janus.log("Playout has started!");
												} else if(event === 'stopped') {
													Janus.log("Session has stopped!");
													var id = result["id"];
													if(recordingId) {
														if(recordingId !== id) {
															Janus.warn("Not a stop to our recording?");
															return;
														}
														bootbox.alert("Recording completed! Check the list of recordings to replay it.");
													}
													if(selectedRecording) {
														if(selectedRecording !== id) {
															Janus.warn("Not a stop to our playout?");
															return;
														}
													}
													// FIXME Reset status
													recordplay.hangup();
												}
											}
										} else {
											// FIXME Error?
											var error = msg["error"];
											bootbox.alert(error);
											// FIXME Reset status
											recordplay.hangup();
										}
									},
									oncleanup: function() {
										Janus.log(" ::: Got a cleanup notification :::");

									}
								});	
						},
						error: function(error) {
							Janus.error(error);
							bootbox.alert(error, function() {
								//window.location.reload();
							});
						},
						destroyed: function() {
							//window.location.reload();
						}
					});
			});
		}
	}
}



function startRecording(recordplay) {
		// bitrate and keyframe interval can be set at any time:
		// before, after, during recording
// bitrate and keyframe interval can be set at any time:
	// before, after, during recording
	recordplay.send({
		message: {
			"request" : "configure",
			"video-bitrate-max": 1024 * 1024,		// a quarter megabit
			"video-keyframe-interval": 15000	// 15 seconds
		}
	});

	recordplay.createOffer(
		{
			// By default, it's sendrecv for audio and video... no datachannels
			// If you want to test simulcasting (Chrome and Firefox only), then
			// pass a ?simulcast=true when opening this demo page: it will turn
			// the following 'simulcast' property to pass to janus.js to true
			
			success: function(jsep) {
				Janus.debug("Got SDP!", jsep);
				var body = { request: "record", name: myusername };
				
				recordplay.send({ message: body, jsep: jsep });
			},
			error: function(error) {
				Janus.error("WebRTC error...", error);
				bootbox.alert("WebRTC error... " + error.message);
				recordplay.hangup();
			}
		});

}

function publishOwnFeed(useAudio) {
	// Publish our stream
	$('#publish').attr('disabled', true).unbind('click');
	sfutest.createOffer(
		{
			// Add data:true here if you want to publish datachannels as well
			media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true },	// Publishers are sendonly
			// If you want to test simulcasting (Chrome and Firefox only), then
			// pass a ?simulcast=true when opening this demo page: it will turn
			// the following 'simulcast' property to pass to janus.js to true
			success: function (jsep) {
				Janus.debug("Got publisher SDP!", jsep);
				publisherJsep = jsep;
				var publish = { request: "configure", audio: useAudio, video: true };
				// You can force a specific codec to use when publishing by using the
				// audiocodec and videocodec properties, for instance:
				// 		publish["audiocodec"] = "opus"
				// to force Opus as the audio codec to use, or:
				// 		publish["videocodec"] = "vp9"
				// to force VP9 as the videocodec to use. In both case, though, forcing
				// a codec will only work if: (1) the codec is actually in the SDP (and
				// so the browser supports it), and (2) the codec is in the list of
				// allowed codecs in a room. With respect to the point (2) above,
				// refer to the text in janus.plugin.videoroom.jcfg for more details
				sfutest.send({ message: publish, jsep: jsep });
			},
			error: function (error) {
				Janus.error("WebRTC error:", error);
				if (useAudio) {
					publishOwnFeed(false);
				} else {
					bootbox.alert("WebRTC error... " + error.message);
					$('#publish').removeAttr('disabled').click(function () { publishOwnFeed(true); });
				}
			}
		});
}

function toggleMute() {
	var muted = sfutest.isAudioMuted();
	Janus.log((muted ? "Unmuting" : "Muting") + " local stream...");
	if (muted)
		sfutest.unmuteAudio();
	else
		sfutest.muteAudio();
	muted = sfutest.isAudioMuted();
	$('#mute').html(muted ? "Unmute" : "Mute");
}

function unpublishOwnFeed() {
	// Unpublish our stream
	$('#unpublish').attr('disabled', true).unbind('click');
	var unpublish = { request: "unpublish" };
	sfutest.send({ message: unpublish });

}

// Helper to parse query string
function getQueryStringValue(name) {
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
		results = regex.exec(location.search);
	return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}
//Hub Methods

//Creating RTP Forwarder.
connection.on("CreateRtpForwarder", (hostIp, audioPort, videoPort) => {
	var rtpforward = {
		"request": "rtp_forward",
		"publisher_id": myid,
		"room": myroom,
		"audio_port": audioPort,
		"audio_pt": 111,
		"video_port": videoPort,
		"video_pt": 100,
		"host": hostIp,
		"secret": "adminpwd"
	};
	sfutest.send({
		message: rtpforward,
		success: function (result) {
			console.log(JSON.stringify(result));
		}
	});

	console.log("WebRTC forwarded " + JSON.stringify(rtpforward));
});

//On Viewer Connected
connection.on("ViewerConnected", (viewerList) => {
	$('#viewerlist').empty();

	if (viewerList != null) {
		viewerList.forEach(viewer => {
			$('#viewerlist').append($('<li>').text(viewer.userName));
		});
		$('#viewerscount').html(viewerList.length);
	}

});

//On Viewer Left
connection.on("ViewerLeft", (viewerList) => {
	$('#viewerlist').empty();

	if (viewerList.length > 0) {
		viewerList.forEach(viewer => {
			$('#viewerlist').append($('<li>').text(viewer.userName));
		});

	}

	$('#viewerscount').html(viewerList.length);
});

//On Viewer Comment
connection.on("ViewerComment", (commentList) => {
	$('#commentlist').empty();
	if (commentList != null) {
		commentList.forEach(comment => {
			$('#commentlist').append('<li>' +
				'<h4>' + '<span>' + comment.viewerName  + '</span>' + '</h4></ br>'
				+
				'<h5>' + comment.commentString + '</h5></ br>'
				+ '</li><hr>');
		});
	}
	$('#commentCount').html(commentList.length);
});

async function stoplive() {

	recordHandles.forEach(recordHandle=>{
		var stop = { request: "stop" };
		recordHandle.send({ message: stop });
		recordHandle.hangup();
	});
	await connection.invoke("StopLive");
}

connection.onclose(() => {
	stoplive();
});

window.addEventListener('beforeunload', function (e) {
	// Cancel the event
	connection.stop();
	e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
	e.returnValue = '';
  });