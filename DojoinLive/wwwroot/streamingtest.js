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
var viewerConnectionId = null;
var viewerName = null;
var newComment = null;
var liveConnectionId = null;
var janus_instance_local_ip;

const connection = new signalR.HubConnectionBuilder()
	.withUrl("https://localhost:44331/live")
	.configureLogging(signalR.LogLevel.Debug)
	.build();
connection.logging = true;
async function start() {
	try {
		await connection.start();
		console.log("SignalR Connected");
		const hubConnectionId = await connection.invoke("GetConnectionId");
		viewerConnectionId = hubConnectionId;
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


var server = null;
var janus = null;
var streaming = null;
var opaqueId = "streamingtest-" + Janus.randomString(12);

var bitrateTimer = null;
var spinner = null;

var simulcastStarted = false, svcStarted = false;

var selectedStream = null;

//For Recorded Media
var recordplay = null;
var opaqueIdR = "recordplaytest-"+Janus.randomString(12);
var playing = false;
var selectedRecording = null;
var selectedRecordingInfo = null;
var isStreaming = null;
var recordingId = null;
//


$(document).ready(function () {

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
							// Attach to Streaming plugin
							janus.attach(
								{
									plugin: "janus.plugin.streaming",
									opaqueId: opaqueId,
									success: function (pluginHandle) {
										$('#details').remove();
										streaming = pluginHandle;
										Janus.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");
										///Load Live Stream

										// Setup streaming session
										$('#update-streams').click(updateStreamsList);
										updateStreamsList();
										

										$('#watch').removeAttr('disabled').unbind('click').click(startStream);



										$('#viewerName').focus();
										$('#sendComment').attr('disabled', true);
										//
										//Get Viewer Name
										$('#accept').click(function () {
											if ($('#viewerName').val() != "") {
												viewerName = $('#viewerName').val();
												$('#streamslist').removeAttr('disabled');
												$('#watch').removeAttr('disabled');
												$('#play').removeAttr('disabled');
												$('#recslist').removeAttr('disabled');
												$('#accept').attr('disabled', true);
											}
											else {
												alert("Please Enter Your Name.")
											}

										});
										//
										//Bind Comment
										$('#sendComment').click(function () {
											newComment = $('#newComment').val();
											connection.invoke("ViewerComment", liveConnectionId, newComment);
											$('#newComment').val("");
										});
										//
										$('#start').removeAttr('disabled').html("Stop")
											.click(function () {
												$(this).attr('disabled', true);
												clearInterval(bitrateTimer);
												//Stopping on big Stop
												stopStream();
												janus.destroy();
												$('#streamslist').attr('disabled', true);
												$('#watch').attr('disabled', true).unbind('click');
												$('#start').attr('disabled', true).html("Bye").unbind('click');
											});
									},
									error: function (error) {
										Janus.error("  -- Error attaching plugin... ", error);
										bootbox.alert("Error attaching plugin... " + error);
									},
									iceState: function (state) {
										Janus.log("ICE state changed to " + state);
									},
									webrtcState: function (on) {
										Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
									},
									onmessage: function (msg, jsep) {
										Janus.debug(" ::: Got a message :::", msg);
										var result = msg["result"];
										if (result) {
											if (result["status"]) {
												var status = result["status"];
												if (status === 'starting')
													$('#status').removeClass('hide').text("Starting, please wait...").show();
												else if (status === 'started')
													$('#status').removeClass('hide').text("Started").show();
												else if (status === 'stopped')
													stopStream();
											} else if (msg["streaming"] === "event") {
												// Is simulcast in place?
												var substream = result["substream"];
												var temporal = result["temporal"];
												if ((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
													if (!simulcastStarted) {
														simulcastStarted = true;
														addSimulcastButtons(temporal !== null && temporal !== undefined);
													}
													// We just received notice that there's been a switch, update the buttons
													updateSimulcastButtons(substream, temporal);
												}
												// Is VP9/SVC in place?
												var spatial = result["spatial_layer"];
												temporal = result["temporal_layer"];
												if ((spatial !== null && spatial !== undefined) || (temporal !== null && temporal !== undefined)) {
													if (!svcStarted) {
														svcStarted = true;
														addSvcButtons();
													}
													// We just received notice that there's been a switch, update the buttons
													updateSvcButtons(spatial, temporal);
												}
											}
										} else if (msg["error"]) {
											bootbox.alert(msg["error"]);
											stopStream();
											return;
										}
										if (jsep) {
											Janus.debug("Handling SDP as well...", jsep);
											var stereo = (jsep.sdp.indexOf("stereo=1") !== -1);
											// Offer from the plugin, let's answer
											streaming.createAnswer(
												{
													jsep: jsep,
													// We want recvonly audio/video and, if negotiated, datachannels
													media: { audioSend: false, videoSend: false, data: true },
													customizeSdp: function (jsep) {
														if (stereo && jsep.sdp.indexOf("stereo=1") == -1) {
															// Make sure that our offer contains stereo too
															jsep.sdp = jsep.sdp.replace("useinbandfec=1", "useinbandfec=1;stereo=1");
														}
													},
													success: function (jsep) {
														Janus.debug("Got SDP!", jsep);
														var body = { request: "start" };
														streaming.send({ message: body, jsep: jsep });
														$('#watch').html("Stop").removeAttr('disabled').click(stopStream);
														$('#sendComment').removeAttr('disabled');
														console.log("Created Answer Successfully")
													},
													error: function (error) {
														Janus.error("WebRTC error:", error);
														bootbox.alert("WebRTC error... " + error.message);
													}
												});
										}
									},
									onremotestream: function (stream) {
										Janus.debug(" ::: Got a remote stream :::", stream);
										var addButtons = false;
										if ($('#remotevideo').length === 0) {
											addButtons = true;
											$('#stream').append('<video class="rounded centered hide" id="remotevideo" width="100%" height="100%" autoplay="true" playsinline/>');
											$('#remotevideo').get(0).volume = 0;
											// Show the stream and hide the spinner when we get a playing event
											$("#remotevideo").bind("playing", function () {
												$('#waitingvideo').remove();
												if (this.videoWidth)
													$('#remotevideo').removeClass('hide').show();
												if (spinner)
													spinner.stop();
												spinner = null;
												var videoTracks = stream.getVideoTracks();
												if (!videoTracks || videoTracks.length === 0)
													return;
												var width = this.videoWidth;
												var height = this.videoHeight;
												$('#curres').removeClass('hide').text(width + 'x' + height).show();
												if (Janus.webRTCAdapter.browserDetails.browser === "firefox") {
													// Firefox Stable has a bug: width and height are not immediately available after a playing
													setTimeout(function () {
														var width = $("#remotevideo").get(0).videoWidth;
														var height = $("#remotevideo").get(0).videoHeight;
														$('#curres').removeClass('hide').text(width + 'x' + height).show();
													}, 2000);
												}
											});
										}
										Janus.attachMediaStream($('#remotevideo').get(0), stream);
										$("#remotevideo").get(0).play();
										$("#remotevideo").get(0).volume = 1;
										var videoTracks = stream.getVideoTracks();
										if (!videoTracks || videoTracks.length === 0) {
											// No remote video
											$('#remotevideo').hide();
											if ($('#stream .no-video-container').length === 0) {
												$('#stream').append(
													'<div class="no-video-container">' +
													'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
													'<span class="no-video-text">No remote video available</span>' +
													'</div>');
											}
										} else {
											$('#stream .no-video-container').remove();
											$('#remotevideo').removeClass('hide').show();
										}
										if (!addButtons)
											return;
										if (videoTracks && videoTracks.length &&
											(Janus.webRTCAdapter.browserDetails.browser === "chrome" ||
												Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
												Janus.webRTCAdapter.browserDetails.browser === "safari")) {
											$('#curbitrate').removeClass('hide').show();
											bitrateTimer = setInterval(function () {
												// Display updated bitrate, if supported
												var bitrate = streaming.getBitrate();
												$('#curbitrate').text(bitrate);
												// Check if the resolution changed too
												var width = $("#remotevideo").get(0).videoWidth;
												var height = $("#remotevideo").get(0).videoHeight;
												if (width > 0 && height > 0)
													$('#curres').removeClass('hide').text(width + 'x' + height).show();
											}, 1000);
										}
									},
									ondataopen: function (data) {
										Janus.log("The DataChannel is available!");
										$('#waitingvideo').remove();
										$('#stream').append(
											'<input class="form-control" type="text" id="datarecv" disabled></input>'
										);
										if (spinner)
											spinner.stop();
										spinner = null;
									},
									ondata: function (data) {
										Janus.debug("We got data from the DataChannel!", data);
										$('#datarecv').val(data);
									},
									oncleanup: function () {
										Janus.log(" ::: Got a cleanup notification :::");
										$('#waitingvideo').remove();
										$('#remotevideo').remove();
										$('#datarecv').remove();
										$('.no-video-container').remove();
										$('#bitrate').attr('disabled', true);
										$('#bitrateset').html('Bandwidth<span class="caret"></span>');
										$('#curbitrate').hide();
										if (bitrateTimer)
											clearInterval(bitrateTimer);
										bitrateTimer = null;
										$('#curres').hide();
										$('#simulcast').remove();

										simulcastStarted = false;
									}
								});

								//RecordPlay
								janus.attach(
									{
										plugin: "janus.plugin.recordplay",
										opaqueId: opaqueIdR,
										success: function(pluginHandle) {
											$('#details').remove();
											recordplay = pluginHandle;
											Janus.log("Plugin attached! (" + recordplay.getPlugin() + ", id=" + recordplay.getId() + ")");
											$('#update-rec').click(updateRecsList);
											updateRecsList();
										},
										error: function(error) {
											Janus.error("  -- Error attaching plugin...", error);
											bootbox.alert("  -- Error attaching plugin... " + error);
										},
										consentDialog: function(on) {
											Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
											if(on) {
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
													} });
											} else {
												// Restore screen
												$.unblockUI();
											}
										},
										iceState: function(state) {
											Janus.log("ICE state changed to " + state);
										},
										mediaState: function(medium, on) {
											Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
										},
										webrtcState: function(on) {
											Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
											//$("#videobox").parent().unblock();
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
																	//bootbox.alert("WebRTC error... " + error.message);
																}
															});
														if(result["warning"])
															bootbox.alert(result["warning"]);
													} else if(event === 'recording') {
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
														$('#videobox').empty();
														$('#video').hide();
													
														recordplay.hangup();
													
														$('#play').removeAttr('disabled').click(startPlayout);
													
														$('#recset').removeAttr('disabled');
														$('#recslist').removeAttr('disabled');
														updateRecsList();
													}
												}
											} else {
												// FIXME Error?
												var error = msg["error"];
												bootbox.alert(error);
												// FIXME Reset status
												$('#videobox').empty();
												$('#video').hide();
											
												recordplay.hangup();
												
												$('#play').removeAttr('disabled').click(startPlayout);
												
												$('#recset').removeAttr('disabled');
												$('#recslist').removeAttr('disabled');
												updateRecsList();
											}
										},
										onlocalstream: function(stream) {
											if(playing === true)
												return;
											Janus.debug(" ::: Got a local stream :::", stream);
											$('#videotitle').html("Recording...");
											$('#stoprecorded').unbind('click').click(stop);
											$('#video').removeClass('hide').show();
											if($('#thevideo').length === 0)
												$('#videobox').append('<video class="rounded centered" id="thevideo" width="100%" height="100%" autoplay playsinline muted="muted"/>');
											Janus.attachMediaStream($('#thevideo').get(0), stream);
											$("#thevideo").get(0).muted = "muted";
											if(recordplay.webrtcStuff.pc.iceConnectionState !== "completed" &&
													recordplay.webrtcStuff.pc.iceConnectionState !== "connected") {
												$("#videobox").parent().block({
													message: '<b>Publishing...</b>',
													css: {
														border: 'none',
														backgroundColor: 'transparent',
														color: 'white'
													}
												});
											}
											var videoTracks = stream.getVideoTracks();
											if(!videoTracks || videoTracks.length === 0) {
												// No remote video
												$('#thevideo').hide();
												if($('#videobox .no-video-container').length === 0) {
													$('#videobox').append(
														'<div class="no-video-container">' +
															'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
															'<span class="no-video-text">No remote video available</span>' +
														'</div>');
												}
											} else {
												$('#videobox .no-video-container').remove();
												$('#thevideo').removeClass('hide').show();
											}
										},
										onremotestream: function(stream) {
											
											Janus.debug(" ::: Got a remote stream :::", stream);
											if($('#thevideo').length === 0) {
												$('#videotitle').html(selectedRecordingInfo);
												$('#stoprecorded').unbind('click').click(stop);
												$('#video').removeClass('hide').show();
												$('#videobox').append('<video class="rounded centered hide" id="thevideo" width="100%" height="100%" autoplay playsinline/>');
												// No remote video yet
												$('#videobox').append('<video class="rounded centered" id="waitingvideo" width="100%" height="100%" />');
												if(spinner == null) {
													var target = document.getElementById('videobox');
													spinner = new Spinner({top:100}).spin(target);
												} else {
													spinner.spin();
												}
												// Show the video, hide the spinner and show the resolution when we get a playing event
												$("#thevideo").bind("playing", function () {
													$('#waitingvideo').remove();
													$('#thevideo').removeClass('hide');
													if(spinner)
														spinner.stop();
													spinner = null;
												});
											}
											Janus.attachMediaStream($('#thevideo').get(0), stream);
											var videoTracks = stream.getVideoTracks();
											if(!videoTracks || videoTracks.length === 0) {
												// No remote video
												$('#thevideo').hide();
												if($('#videobox .no-video-container').length === 0) {
													$('#videobox').append(
														'<div class="no-video-container">' +
															'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
															'<span class="no-video-text">No remote video available</span>' +
														'</div>');
												}
											} else {
												$('#videobox .no-video-container').remove();
												$('#thevideo').removeClass('hide').show();
											}
										},
										ondataopen: function(data) {
											Janus.log("The DataChannel is available!");
											$('#datafield').parent().removeClass('hide');
											if(playing === false) {
												// We're recording, use this field to send data
												$('#datafield').attr('placeholder', 'Write a message to record');
												$('#datafield').removeAttr('disabled');
											}
										},
										ondata: function(data) {
											Janus.debug("We got data from the DataChannel!", data);
											if(playing === true)
												$('#datafield').val(data);
										},
										oncleanup: function() {
											Janus.log(" ::: Got a cleanup notification :::");
											// FIXME Reset status
											$('#waitingvideo').remove();
											if(spinner)
												spinner.stop();
											spinner = null;
											$('#videobox').empty();
											
											$('#video').hide();
											$('#datafield').attr('disabled', true).attr('placeholder', '').val('');
											$('#datafield').parent().addClass('hide');
											
											$('#play').removeAttr('disabled').click(startPlayout);
											
											$('#recset').removeAttr('disabled');
											$('#recslist').removeAttr('disabled');

											$('#watch').removeAttr('disabled');
											$('#streamlist').removeAttr('disabled');
											updateRecsList();
										}
									});
								//
						},
						error: function (error) {
							Janus.error(error);
							bootbox.alert(error, function () {
								window.location.reload();
							});
						},
						destroyed: function () {
							window.location.reload();
						}
					});
			});
		}
	});
});



function updateStreamsList() {
	$('#update-streams').unbind('click').addClass('fa-spin');
	var body = { request: "list" };
	Janus.debug("Sending message:", body);
	streaming.send({
		message: body, success: function (result) {
			setTimeout(function () {
				$('#update-streams').removeClass('fa-spin').click(updateStreamsList);
			}, 500);
			if (!result) {
				bootbox.alert("Got no response to our query for available streams");
				return;
			}
			if (result["list"]) {
				$('#streams').removeClass('hide').show();
				$('#streamslist').empty();
				$('#watch').attr('disabled', true);
				var list = result["list"];
				Janus.log("Got a list of available streams");
				if (list && Array.isArray(list)) {
					list.sort(function (a, b) {
						if (!a || a.id < (b ? b.id : 0))
							return -1;
						if (!b || b.id < (a ? a.id : 0))
							return 1;
						return 0;
					});
				}
				Janus.debug(list);
				$('#metadata').empty();
				for (var mp in list) {
					Janus.debug("  >> [" + list[mp]["id"] + "] " + list[mp]["description"] + " (" + list[mp]["type"] + ")");
					$('#streamslist').append("<li><a href='#' id='" + list[mp]["id"] + "'>" + list[mp]["description"] + "</a></li>");

					//Live List

					$('#metadata').append($('<li>').text(list[mp]["description"]));
					$('#info').removeClass('hide').show();
				}
				$('#streamslist a').unbind('click').click(function () {
					selectedStream = $(this).attr("id");
					$('#streamset').html($(this).html()).parent().removeClass('open');
					return false;

				});
				$('#watch').removeAttr('disabled');
				if (viewerName == null) {
					$('#streamslist').attr('disabled', true);
					$('#watch').attr('disabled', true);
					$('#play').attr('disabled', true);
					$('#recslist').attr('disabled', true);
				}
			}
		}
	});


}

function updateRecsList() {
	$('#update-rec').unbind('click').addClass('fa-spin');
	var body = { request: "list" };
	Janus.debug("Sending message:", body);
	recordplay.send({ message: body, success: function(result) {
		setTimeout(function () {
			$('#update-rec').removeClass('fa-spin').click(updateRecsList);
		}, 500);
		if(!result) {
			bootbox.alert("Got no response to our query for available recordings");
			return;
		}
		if(result["list"]) {
			$('#recslist').empty();
		
			
			var list = result["list"];
			list.sort(function(a, b) {return (a["date"] < b["date"]) ? 1 : ((b["date"] < a["date"]) ? -1 : 0);} );
			Janus.debug("Got a list of available recordings:", list);
			for(var mp in list) {
				Janus.debug("  >> [" + list[mp]["id"] + "] " + list[mp]["name"] + " (" + list[mp]["date"] + ")");
				$('#recslist').append("<li><a href='#' id='" + list[mp]["id"] + "'>" + list[mp]["name"] + "</a></li>");
			}
			$('#recslist a').unbind('click').click(function() {
				selectedRecording = $(this).attr("id");
				selectedRecordingInfo = $(this).text();
				$('#recset').html($(this).html()).parent().removeClass('open');
				$('#play').removeAttr('disabled').click(startPlayout);
				return false;
			});
		}
	}});
}



function getStreamInfo() {

	if (!selectedStream)
		return;
	// Send a request for more info on the mountpoint we subscribed to
	var body = { request: "info", id: parseInt(selectedStream) || selectedStream };
	streaming.send({
		message: body, success: function (result) {
			if (result && result.info && result.info.metadata) {

				liveConnectionId = result.info.metadata;
				connection.invoke("JoinLive", viewerName, viewerConnectionId, liveConnectionId);
			}
		}
	});
}

function startStream() {
	isStreaming = true;
	$('#play').unbind('click').attr('disabled', true);
	$('#recset').attr('disabled', true);
	$('#recslist').attr('disabled', true);

	Janus.log("Selected video id #" + selectedStream);
	if (!selectedStream) {
		bootbox.alert("Select a stream from the list");
		return;
	}
	$('#streamset').attr('disabled', true);
	$('#streamslist').attr('disabled', true);
	$('#accept').attr('disabled', true);
	$('#watch').attr('disabled', true).unbind('click');
	var body = { request: "watch", id: parseInt(selectedStream) || selectedStream };
	streaming.send({ message: body });
	// No remote video yet
	$('#stream').append('<video class="rounded centered" id="waitingvideo" width="100%" height="100%" />');
	if (spinner == null) {
		var target = document.getElementById('stream');
		spinner = new Spinner({ top: 100 }).spin(target);
	} else {
		spinner.spin();
	}
	$('#div-comment').removeClass('hide').show();
	$('#commentbox').removeClass('hide').show();
	// Get some more info for the mountpoint to display, if any
	//Important to get Live Connection Id
	getStreamInfo();
}

//For Recorded Media
function startPlayout() {
	if(isStreaming)
	{
		alert("Stop watching Live Stream.")
		return;
	}
		
	// Start a playout
	
	if(!selectedRecording) {
		return;
	}

	$('#play').unbind('click').attr('disabled', true);
	$('#recset').attr('disabled', true);
	$('#recslist').attr('disabled', true);
	$('#sendComment').attr('disabled', true);

	$('#watch').attr('disabled', true);
	$('#streamlist').attr('disabled', true);
	$('#div-comment').addClass('hide').hide();
	$('#commentbox').addClass('hide').hide();
	

	var play = { request: "play", id: parseInt(selectedRecording) };
	recordplay.send({ message: play });
}

function stop() {
	// Stop a recording/playout
	$('#stoprecorded').unbind('click');
	$('#watch').removeAttr('disabled');

	$('#streamset').removeAttr('disabled');
	$('#streamslist').removeAttr('disabled');

	$('#play').removeAttr('disabled');
	$('#recset').removeAttr('disabled');
	$('#recslist').removeAttr('disabled');
	var stop = { request: "stop" };
	recordplay.send({ message: stop });
	recordplay.hangup();
	updateRecsList();
}



//Hub Functions 
function stopStream() {
	liveConnectionId = null;
	isStreaming = false;
	$('#div-comment').addClass('hide').hide();
	$('#commentbox').addClass('hide').hide();

	connection.invoke("LeaveLive");
}

//Fetch Anyone New Live
connection.on("NewLive", () => {
	updateStreamsList();
});

//Destroy Streaming MountPoint
connection.on("LiveOver", () => {
	stopStream();
	
});

connection.on("UpdateLiveList", () => {
	updateStreamsList();
	setTimeout(function () {
		updateRecsList();
	}, 2000);
});
//On Comment
connection.on("ViewerComment", (commentList) => {
	$('#commentlist').empty();
	if (commentList != null) {
		commentList.forEach(comment => {
			$('#commentlist').append('<li>' +
				'<h4>' + '<span>' + comment.viewerName + '</span>' + '</h4></ br>'
				+
				'<h5>' + String(comment.commentString) + '</h5></ br>'
				+ '</li><hr>');
		});
	}
	$('#commentCount').html(commentList.length);
});
//
connection.on("ViewerLeft", () => {
	isStreaming = false;
	$('#watch').attr('disabled', true).unbind('click');
	$('#watch').html("Watch or Listen").removeAttr('disabled').click(startStream);

	$('#streamset').removeAttr('disabled');
	$('#streamslist').removeAttr('disabled');

	$('#play').removeAttr('disabled');
	$('#recset').removeAttr('disabled');
	$('#recslist').removeAttr('disabled');
	$('#div-comment').addClass('hide').hide();
	$('#commentbox').addClass('hide').hide();


	$('#status').empty().hide();
	$('#bitrate').attr('disabled', true);
	$('#bitrateset').html('Bandwidth<span class="caret"></span>');
	$('#curbitrate').hide();
	if (bitrateTimer)
		clearInterval(bitrateTimer);
	bitrateTimer = null;
	$('#curres').empty().hide();
	$('#simulcast').remove();
	simulcastStarted = false;
	var body = { request: "stop" };
	streaming.send({ message: body });
	streaming.hangup();
	updateRecsList();

});




