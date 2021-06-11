using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DojoinLive.Models;
using DojoinLive.Janus;

namespace DojoinLive.Hubs
{
public class LiveHub : Hub
    {
     

    public string SelectServer()
        {
            string server = ServerList.Servers.Dequeue();
            ServerList.Servers.Enqueue(server);
            return server;
        }

        public string GetConnectionId()
        {
            if (ServerList.Servers.Count < ServerList.serverList.Count)
            {
                ServerList.ServerQueue();
            }
            return Context.ConnectionId;
        }

        public List<StreamingServer> GetStreamingServers()
        {
            List<StreamingServer> streamingServers = new List<StreamingServer>();

            foreach (string server in ServerList.serverList)
            {
                var streamingServer = new StreamingServer()
                {
                    ServerIp = server,
                    AudioPort = RandomPort.GetRandomPort(server),
                    VideoPort = RandomPort.GetRandomPort(server)

                };
                streamingServers.Add(streamingServer);
            }
            return streamingServers;

        }

        public async Task GetLiveUsers()
        {
            await Clients.All.SendAsync("LiveList", User.LiveUsers);
        }

        public async Task StartLive(string userName, string connectionId, long roomId)
        {
            var newLiveUser = new User
            {
                UserName = userName,
                ConnectionId = connectionId,
                IsLive = true,
                IsViewing = null,
                RoomId = roomId
            };

            User.LiveUsers.Add(newLiveUser);

            //For Comments
            await Groups.AddToGroupAsync(connectionId, connectionId);

        }

        public async Task NewLive()
        {
            //Manage MountPoint
            await Clients.Others.SendAsync("NewLive");
        }

        public async Task JoinLive(string userName, string connectionId, string liveConnectionId)
        {
            try
            {
                var liveUser = User.LiveUsers.FirstOrDefault(l => l.ConnectionId == liveConnectionId);
                var viewer = new User
                {
                    UserName = userName,
                    ConnectionId = connectionId,
                    IsLive = false,
                    IsViewing = liveUser,
                    RoomId = liveUser.RoomId
                };
                User.Viewers.Add(viewer);

                List<User> viewerList = User.Viewers.FindAll(v => v.IsViewing.ConnectionId == liveConnectionId);
                await Clients.Client(liveConnectionId).SendAsync("ViewerConnected", viewerList);

                //For Comments
                await Groups.AddToGroupAsync(connectionId, liveConnectionId);
                //Viewer Receives all comments on joining.
                await Clients.Caller.SendAsync("ViewerComment", Comment.GetComments(liveConnectionId));
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error in Join Live." + ex.Message);
            }


        }

        public async Task LeaveLive()
        {
            if (User.Viewers.Count > 0)
            {
                try
                {
                    var viewer = User.Viewers.FirstOrDefault(u => u.ConnectionId == Context.ConnectionId);

                    if (viewer != null)
                    {
                        var liveConnectionId = viewer.IsViewing.ConnectionId;

                        User.Viewers.Remove(viewer);
                        List<User> viewerList = User.Viewers.FindAll(v => v.IsViewing.ConnectionId == liveConnectionId);
                        await Clients.Client(liveConnectionId).SendAsync("ViewerLeft", viewerList);
                        await Clients.Caller.SendAsync("ViewerLeft");
                        await Groups.RemoveFromGroupAsync(Context.ConnectionId, liveConnectionId);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Error in Viewer leaving Live: " + ex.Message);
                }
            }


        }

        public async Task StopLive()
        {
            try
            {
                var live = User.LiveUsers.Find(l => l.IsLive == true && l.ConnectionId == Context.ConnectionId);
                string liveConnectionId = Context.ConnectionId;
                

                if (live != null)
                {
                    User.LiveUsers.Remove(live);

                    List<RtpForwarder> rtpList = new List<RtpForwarder>();
                    rtpList = RtpForwarder.GetRtpForwarder(live);

                    //Added Code to Clear Random Port List
                    foreach (RtpForwarder r in rtpList)
                    {
                        var audioPort = r.AudioPort;
                        var videoPort = r.VideoPort;
                        var hostip = r.HostIp;

                        RandomPort randAudioPort = RandomPort.GetPort(hostip, audioPort);
                        RandomPort randVideoPort = RandomPort.GetPort(hostip, videoPort);
                        if (randAudioPort != null)
                        {
                            RandomPort.ServerPorts.Remove(randAudioPort);
                        }
                        if (randVideoPort != null)
                        {
                            RandomPort.ServerPorts.Remove(randVideoPort);
                        }

                        DestroyStream(r.StreamId, r.HostIp);
                    }

                    RtpForwarder.rtpForwarders.RemoveAll(l => l.User == live);
                    await Clients.Group(liveConnectionId).SendAsync("LiveOver");
                    await Clients.Others.SendAsync("UpdateLiveList");
                }
            }
            catch (Exception ex)
            {

                Console.WriteLine("Error in Stopping Live: " + ex.Message);
            }

        }

        public void DestroyStream(long streamId, string hostIp)
        {
            JanusRestClient janus = new JanusRestClient("http://" + hostIp + ":8088/janus");
            janus.InitializeConnection();
            janus.DestroyStream(streamId);
            janus.CleanUp();

        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            await StopLive();
            await LeaveLive();
            await base.OnDisconnectedAsync(exception);
        }


        public async Task SendRtpPorts(string liveConnectionId, string hostIp, int audioPort, int videoPort, long streamId)
        {
            //Implement Get Open Ports //Use Stream Mountpoints

            var liveUser = User.LiveUsers.FirstOrDefault(l => l.ConnectionId == liveConnectionId);
            var rtpForward = new RtpForwarder
            {
                User = liveUser,
                HostIp = hostIp,
                AudioPort = audioPort,
                VideoPort = videoPort,
                StreamId = streamId
            };
            RtpForwarder.rtpForwarders.Add(rtpForward);

            //Creating Streaming MountPoint

            await Clients.Caller.SendAsync("CreateRtpForwarder", hostIp, audioPort, videoPort);

        }

        public async Task ViewerComment(string liveConnectionId, string newComment)
        {
            try
            {
                var viewer = User.Viewers.FirstOrDefault(v => v.ConnectionId == Context.ConnectionId && v.IsViewing.ConnectionId == liveConnectionId);
                var comment = new Comment
                {
                    ViewerName = viewer.UserName,
                    CommentString = newComment,
                    LiveConnectionId = liveConnectionId,
                    TimeStampString = DateTime.Now.ToString("hh:mm tt"),
                    TimeStamp = DateTime.Now
                };
                Comment.comments.Add(comment);
                //All Viewers receive the comment list with new comment.
                await Clients.Group(liveConnectionId).SendAsync("ViewerComment", Comment.GetComments(liveConnectionId));
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error in getting viewer: " + ex.Message);
            }

        }

    }
}
