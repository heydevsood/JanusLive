# JanusLive
Open-Source Live Streaming using Janus WebRTC Media Server &amp; .NET Core SignalR

JanusLive is an open-source Live Streaming project using Janus WebRTC Media Server and .Net Core SignalR.

Using Janus is like using WebRTC on steroids. SignalR has been used for Real time communication such as viewers, comments, servers and triggering real time functions execution on
streamer's side and viewer side.

Features:
1. Start Live Stream and Watch a Live Stream running on the server.
2. Supports multiple live streams and viewers.
3. Camera Switching for Android & iOS.
4. Recording live stream enabled only for Android and Desktop browsers. iOS has known issues handing multiple WebRTC Streams (Live streams + Recording streams).
5. Can watch recorded live streams.

Instructions:

1. Install Janus WebRTC Media Server on CentOS or Ubuntu. You can find the instructions here: https://github.com/meetecho/janus-gateway
2. If you have trouble installing Janus, you can find a Docker Container with full installation on my Docker profile : https://hub.docker.com/repository/docker/heydevsood/janusgateway
3. Edit ServerList.cs to add address of your Janus Server.
4. Edit videoroomtest.js and streaming.js to add your SignalR hub address to establish connection.
5. For any CORS related issues, you may edit StartUp.cs as per your needs.

Special Thanks to Meetecho Team for creating Janus!
Please go through Janus Documentation for any assistance. https://janus.conf.meetecho.com/
