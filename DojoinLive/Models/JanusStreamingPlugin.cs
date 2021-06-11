using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace JanusLive.Models
{
    public class JanusStreamingPlugin
    {
        public long id { get; set; }
        public string secret { get; set; }
        public bool permanent { get; set; }
    }

    public class JanusStreamingResponse : JanusPluginResponse
    {
        public JanusStreamingPluginData plugindata { get; set; }
    }

    public class JanusStreamingPluginData : JanusPluginData
    {
        public JanusStreamingPluginDataInternal data { get; set; }
    }
    public class JanusStreamingPluginDataInternal
    {
        public long id { get; set; }
        public int error_code { get; set; }
        public string error { get; set; }
    }

    public enum JanusStreamingErrorCodes
    {
        JANUS_STREAMING_ERROR_NONE = 0
    }
}
