using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DojoinLive.Models
{
    public class JanusPlugin
    {
        /// <summary>
        /// Constructs a new plugin.
        /// </summary>
        /// <param name="_handle">The handle on which to send commands</param>
        /// <param name="_type">The plugin type</param>
        public JanusPlugin(int _handle, JanusPluginType _type)
        {
            handle = _handle;
            type = _type;
        }
        /// <summary>
        /// The handle of the plugin. 
        /// To send messages to this plugin send REST commands to: baseURL/SessionToken/handle
        /// </summary>
        public int handle { get; private set; }

        /// <summary>
        /// The plugin type.
        /// </summary>
        public JanusPluginType type { get; private set; }

    }

    public class JanusPluginResponse : JanusBase
    {
        public long session_id { get; set; }
        public long sender { get; set; }
    }

    public class JanusPluginData
    {
        public string plugin { get; set; }
    }

    /// <summary>
    /// Currently supported plugin types. Add plugin type here if you are adding a supported plugin.
    /// </summary>
    public enum JanusPluginType
    {
        AUDIOBRIDGE = 0,
        ECHOTEST = 1,
        RECORDPLAY = 2,
        SIP = 3,
        STREAMING = 4,
        VIDEOCALL = 5,
        VIDEOROOM = 6,
        VOICEMAIL = 7
    }
}

