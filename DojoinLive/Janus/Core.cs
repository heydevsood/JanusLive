﻿using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Linq;
using System.Text;
using RestSharp;
using RestSharp.Deserializers;
using RestSharp.Extensions;
using System.Threading;
using System.Dynamic;
using JanusLive.Models;

namespace JanusLive.Janus
{
    public partial class JanusRestClient
    {
        public long SessionToken { get; private set; }
        private static Random random = new Random();
        public string BaseUrl { get; private set; }
        private RestClient _client;
        private bool keep_alive;
        private string api_secret;
        private static readonly object janus_core_lock_obj = new object();
        private static readonly object thread_monitor = new object();
        private DynamicDelayExecute delay_timeout;
        /// <summary>
        /// Constructs the Rest client and prepares it to start the connection.
        /// You must initialize the connection if you want to start it.
        /// By default, it will not keepAlive and will de-initialize the connection after 30 seconds if no command has been sent for that time.
        /// If it is supposed to keep alive, it will send keepAlive requests to the gateway every 30 seconds if no command has been sent in that time period.
        /// </summary>
        /// <param name="baseUrl">The base url for the Janus gateway, ex: http://192.168.0.123:8088/janus </param>
        /// <param name="keepAlive">Whether to keep the connection alive or not. If no command is sent through the janus base or to any attached plugin for 30 seconds, then it will close</param>
        public JanusRestClient(string baseUrl, bool keepAlive = false, string apiSecret = null)
        {
            BaseUrl = baseUrl;
            keep_alive = keepAlive;
            System.Uri uri = new Uri(BaseUrl);
            _client = new RestClient();
            _client.BaseUrl = uri;
            _client.Timeout = 60000;
            delay_timeout = new DynamicDelayExecute(29);
            delay_timeout.OnDelayExhausted += new EventHandler(OnTimeOutFired);
            api_secret = apiSecret;
        }

        private void OnTimeOutFired(object obj, EventArgs e)
        {
            lock (janus_core_lock_obj)
            {
                if (keep_alive)
                {
                    RestRequest request = new RestRequest(Method.POST);
                    request.RequestFormat = DataFormat.Json;
                    request.Resource = "{SessionToken}";
                    request.AddBody(new { janus = "keepalive", });
                    Execute<JanusBaseResponse>(request);
                    delay_timeout.HardReset(29);
                }
                else
                {
                    InternalCleanUp();
                }
            }
        }

        /// <summary>
        /// Determines if the client is initialized or not. We need to have a sessiontoken from the janus gateway root to do anything.
        /// </summary>
        /// <returns>true if it is initialized, false otherwise</returns>
        public bool IsRestClientInitialized()
        {
            lock (janus_core_lock_obj)
            {
                return SessionToken > 0;
            }
        }

        /// <summary>
        /// Tries to initializes the connection with the gateway.
        /// We need a session token given from the gateway for us to send any commands to it.
        /// </summary>
        /// <returns>True on success, false on failure</returns>
        public bool InitializeConnection()
        {
            bool retVal = false;
            lock (janus_core_lock_obj)
            {
                if (SessionToken == 0)
                {
                    RestRequest request = new RestRequest(Method.POST);
                    request.RequestFormat = DataFormat.Json;
                    dynamic obj = new ExpandoObject();
                    if (api_secret.HasValue()) obj.apisecret = api_secret;
                    obj.janus = "create";
                    obj.transaction = GetNewRandomTransaction();
                    request.AddBody(obj);
                    JanusBaseResponse resp = Execute<JanusBaseResponse>(request);
                    if (resp == null || resp.janus != "success")
                    {
                        retVal = false;
                    }
                    else
                    {
                        SessionToken = resp.data.id;
                        _client.AddDefaultUrlSegment("SessionToken", SessionToken.ToString());
                        delay_timeout.Start();
                        retVal = true;
                    }
                }
            }
            return retVal;
        }

        /// <summary>
        /// This will lazily release all our connections to the janus gateway.
        /// And will disconnect from the janus gateway all together.
        /// </summary>
        public void CleanUp()
        {
            keep_alive = false;
            delay_timeout.Immediate();
        }

        private void InternalCleanUp()
        {
            Console.WriteLine("Starting Internal Cleanup");

            //clean up our plugins first
            DeinitializeStreamingConnection();
            DeinitializeConnection();
            Console.WriteLine("Finished Internal Clean up, should now be reinitialized");
        }

        private void DeinitializeConnection()
        {
            if (SessionToken > 0)
            {
                RestRequest request = new RestRequest(Method.POST);
                request.Resource = "{SessionToken}";
                request.RequestFormat = DataFormat.Json;
                dynamic msg = new ExpandoObject();
                msg.janus = "destroy";
                msg.transaction = GetNewRandomTransaction();
                if (api_secret.HasValue()) msg.apisecret = api_secret;
                request.AddBody(msg);
                Execute<JanusBaseResponse>(request);
                _client.RemoveDefaultParameter("SessionToken");
                SessionToken = 0;
            }
        }

        /// <summary>
        /// Creates a new random alphanumeric string.
        /// This is to keep track of rest requests that are asynchronous, if any are made.
        /// Generally, most of the requests made in this format will be synchronous.
        /// </summary>
        /// <returns>alphanumeric string</returns>
        public string GetNewRandomTransaction()
        {
            var chars = "abcdefghijklmnopqrstuvwxyz1234567890";
            var result = new string(Enumerable.Repeat(chars, 12).Select(s => s[random.Next(s.Length)]).ToArray());
            return result;
        }

        /// <summary>
        /// Execute a REST request against the gateway
        /// </summary>
        /// <typeparam name="T">The type of object to create and return with the response data</typeparam>
        /// <param name="request">The RestRequest to make against the gateway(assumes that the connection is intialized</param>
        /// <returns>The populated response</returns>
        public T Execute<T>(RestRequest request) where T : new()
        {
            request.OnBeforeDeserialization = (resp) =>
            {
                if (((int)resp.StatusCode) >= 400)
                {
                    //TODO determine what we want to do when we hit this...
                    //hit an rest exception...
                }
                //command was successful and the timeout needs to be reset
                else
                {
                    delay_timeout.ResetDelay(29);
                }
            };

            var response = _client.Execute<T>(request);
            return response.Data;
        }
    }
}
