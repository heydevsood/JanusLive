using RestSharp;
using RestSharp.Extensions;
using RestSharp.Validation;
using System.Collections.Generic;
using System.Threading;
using System.Dynamic;
using DojoinLive.Models;
using System.Linq;
using System.Text;
using System;

namespace DojoinLive.Janus
{
    public partial class JanusRestClient
    {
        public long JanusStreamingPluginHandle { get; private set; }
        private static readonly object streaming_lock_obj = new object();
        private MTSafeRefCounter janus_streaming_plugin_ref = new MTSafeRefCounter();

        public JanusStreamingResponse DestroyStream(long id, string secret = "adminpwd", bool permanent = true)
        {
            if (janus_streaming_plugin_ref.IncRef())
            {
                if (InitializeStreamingConnection())
                {
                    if (JanusStreamingPluginHandle > 0)
                    {
                        dynamic obj = new ExpandoObject();
                        obj.request = "destroy";
                        obj.id = id;
                        if (secret.HasValue()) obj.secret = secret;
                        dynamic msg = new ExpandoObject();
                        if (permanent)
                        {
                            obj.permanent = true;
                        }
                        msg.janus = "message";
                        msg.transaction = GetNewRandomTransaction();
                        if (api_secret.HasValue()) msg.apisecret = api_secret;
                        msg.body = obj;
                        var request = new RestRequest(Method.POST);
                        request.RequestFormat = DataFormat.Json;
                        request.Resource = "{SessionToken}/" + JanusStreamingPluginHandle;
                        request.AddBody(msg);
                        try
                        {
                            JanusStreamingResponse response = Execute<JanusStreamingResponse>(request);
                            if (response != null && response.plugindata.data.id > 0)
                                delay_timeout.ResetDelay(29);
                            janus_streaming_plugin_ref.DecRef();

                            return response;
                        }
                        catch (Exception ex)
                        {
                            
                        }
                    }
                }
                else
                {
                    janus_streaming_plugin_ref.DecRef();
                }
            }
            return JanusStreamingSessionShuttingDownError();
        }


        public bool InitializeStreamingConnection()
        {
            if (IsRestClientInitialized() && janus_streaming_plugin_ref.IncRef())
            {
                bool retVal = true;
                lock (streaming_lock_obj)
                {
                    if (JanusStreamingPluginHandle == 0)
                    {
                        RestRequest request = new RestRequest(Method.POST);
                        request.Resource = "{SessionToken}";
                        string transaction = GetNewRandomTransaction();
                        request.RequestFormat = DataFormat.Json;
                        dynamic msg = new ExpandoObject();
                        msg.janus = "attach";
                        msg.plugin = "janus.plugin.streaming";
                        msg.transaction = GetNewRandomTransaction();
                        if (api_secret.HasValue()) msg.apisecret = api_secret;
                        request.AddBody(msg);
                        JanusBaseResponse resp = Execute<JanusBaseResponse>(request);

                        if (resp == (null) || resp.janus == "error")
                        {
                            retVal = false;
                        }
                        else
                        {
                            JanusStreamingPluginHandle = resp.data.id;
                            delay_timeout.ResetDelay(29);
                            retVal = true;
                        }
                    }
                }
                janus_streaming_plugin_ref.DecRef();
                return retVal;
            }
            return false;
        }

        public void DeinitializeStreamingConnection()
        {
            janus_streaming_plugin_ref.BlockIncrease();
            //wait for all the other synchronous calls to finish if we are trying to send them
            while (janus_streaming_plugin_ref.ReferenceCount > 0)
                Thread.Sleep(250);
            lock (streaming_lock_obj)
            {
                if (IsRestClientInitialized() && JanusStreamingPluginHandle > 0)
                {
                    RestRequest request = new RestRequest(Method.POST);
                    request.Resource = "{SessionToken}/" + JanusStreamingPluginHandle;
                    request.RequestFormat = DataFormat.Json;
                    dynamic msg = new ExpandoObject();
                    msg.janus = "detach";
                    msg.transaction = GetNewRandomTransaction();
                    if (api_secret.HasValue()) msg.apisecret = api_secret;
                    request.AddBody(msg);
                    JanusStreamingPluginHandle = 0;
                    Execute<JanusBaseResponse>(request);
                }
                janus_streaming_plugin_ref.UnblockIncrease();
            }
        }

        private JanusStreamingResponse JanusStreamingSessionShuttingDownError()
        {
            var error_resp = new JanusStreamingResponse
            {
                janus = "failure",
                plugindata = new JanusStreamingPluginData
                {
                    plugin = "janus.plugin.streaming",
                    data = new JanusStreamingPluginDataInternal
                    {
                        id = 0,
                        error_code = (int)JanusStreamingErrorCodes.JANUS_STREAMING_ERROR_NONE,
                        error = "Some Error"
                    }
                }
            };
            return error_resp;
        }


    }
}
