using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DojoinLive.Models
{
    public class RtpForwarder
    {
        public User User { get; set; }
        public string HostIp { get; set; }
        public int AudioPort { get; set; }
        public int VideoPort { get; set; }
        public long StreamId { get; set; }

        public static readonly List<RtpForwarder> rtpForwarders = new List<RtpForwarder>();

        public static List<RtpForwarder> GetRtpForwarder(User user)
        {
            return RtpForwarder.rtpForwarders.FindAll(s => s.User == user);
        }
    }
}
