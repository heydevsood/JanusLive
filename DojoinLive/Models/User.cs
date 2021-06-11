using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace JanusLive.Models
{
    public class User
    {
        public string ConnectionId { get; set; }
        public string UserName { get; set; }
        public bool IsLive { get; set; }
        public User IsViewing { get; set; }
        public long RoomId { get; set; }

        public static readonly List<User> Viewers = new List<User>();
        public static readonly List<User> LiveUsers = new List<User>();

    }
}
