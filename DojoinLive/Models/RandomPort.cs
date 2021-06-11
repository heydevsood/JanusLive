using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace JanusLive.Models
{
    public class RandomPort
    {
        public static List<RandomPort> ServerPorts = new List<RandomPort>();
        public int Randomport { get; set; }
        public string ServerIp { get; set; }


        public static int GetRandomPort(string serverIp)
        {
            Random random = new Random();
            int port = random.Next(49152, 65535);


            bool used = RandomPort.IsUsed(serverIp, port);
            if (used)
            {
                GetRandomPort(serverIp);
            }
            else
            {
                var serverPort = new RandomPort()
                {
                    Randomport = port,
                    ServerIp = serverIp
                };

                RandomPort.ServerPorts.Add(serverPort);
                return port;

            }
            return 1;

        }
        public static bool IsUsed(string serverIp, int port)
        {

            var checkport = RandomPort.ServerPorts.Find(p => p.Randomport == port && p.ServerIp == serverIp);

            return RandomPort.ServerPorts.Contains(checkport);
        }

        public static RandomPort GetPort(string hostip, int port)
        {
            var randPort = RandomPort.ServerPorts.FirstOrDefault(sp => sp.ServerIp == hostip && sp.Randomport == port);
            if (randPort != null)
            {
                return randPort;
            }
            return null;
        }
    }
}
