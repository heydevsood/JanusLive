using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace JanusLive.Models
{
    public class ServerList
    {
        public static List<string> serverList = new List<string>()
        {
        //Enter List of Servers Here//
        };
        public static Queue<string> Servers = new Queue<string>();
        public static void ServerQueue()
        {
            foreach (string server in serverList) {
                Servers.Enqueue(server);
            }
        }
    }
}
