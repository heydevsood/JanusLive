﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace JanusLive.Models
{
    public class JanusBase
    {
        /// <summary>
        /// The command to send to the janus gateway
        /// E.g. "create", "success", "attach", "message"
        /// </summary>
        public string janus { get; set; }

        /// <summary>
        /// A random string of alphanumeric characters that will make sure you are part of the same
        /// transaction
        /// </summary>
        public string transaction { get; set; }
    }

    public class JanusBaseResponse : JanusBase
    {
        /// <summary>
        /// The error information returned, if any.
        /// </summary>
        public JanusBaseError error { get; set; }
        /// <summary>
        /// The janus data returned, if any.
        /// </summary>
        public JanusBaseData data { get; set; }
    }

    public class JanusBaseError
    {
        /// <summary>
        /// The Error code returned from the gateway
        /// </summary>
        public long code { get; set; }
        /// <summary>
        /// The reason for the error
        /// </summary>
        public string reason { get; set; }
    }

    public class JanusBaseData
    {
        /// <summary>
        /// The id returned in the success transaction
        /// </summary>
        public long id { get; set; }
    }

    public enum JanusBaseErrorCodes
    {
        /*! \brief Success (no error) */
        JANUS_OK = 0,
        /*! \brief Unauthorized (can only happen when using apisecret) */
        JANUS_ERROR_UNAUTHORIZED = 403,
        /*! \brief Unknown/undocumented error */
        JANUS_ERROR_UNKNOWN = 490,
        /*! \brief The client needs to use HTTP POST for this request */
        JANUS_ERROR_USE_GET = 450,
        /*! \brief The client needs to use HTTP POST for this request */
        JANUS_ERROR_USE_POST = 451,
        /*! \brief The request is missing in the message */
        JANUS_ERROR_MISSING_REQUEST = 452,
        /*! \brief The gateway does not suppurt this request */
        JANUS_ERROR_UNKNOWN_REQUEST = 453,
        /*! \brief The payload is not a valid JSON message */
        JANUS_ERROR_INVALID_JSON = 454,
        /*! \brief The object is not a valid JSON object as expected */
        JANUS_ERROR_INVALID_JSON_OBJECT = 455,
        /*! \brief A mandatory element is missing in the message */
        JANUS_ERROR_MISSING_MANDATORY_ELEMENT = 456,
        /*! \brief The request cannot be handled for this webserver path  */
        JANUS_ERROR_INVALID_REQUEST_PATH = 457,
        /*! \brief The session the request refers to doesn't exist */
        JANUS_ERROR_SESSION_NOT_FOUND = 458,
        /*! \brief The handle the request refers to doesn't exist */
        JANUS_ERROR_HANDLE_NOT_FOUND = 459,
        /*! \brief The plugin the request wants to talk to doesn't exist */
        JANUS_ERROR_PLUGIN_NOT_FOUND = 460,
        /*! \brief An error occurring when trying to attach to a plugin and create a handle  */
        JANUS_ERROR_PLUGIN_ATTACH = 461,
        /*! \brief An error occurring when trying to send a message/request to the plugin */
        JANUS_ERROR_PLUGIN_MESSAGE = 462,
        /*! \brief An error occurring when trying to detach from a plugin and destroy the related handle  */
        JANUS_ERROR_PLUGIN_DETACH = 463,
        /*! \brief The gateway doesn't support this SDP type
         * \todo The gateway currently only supports OFFER and ANSWER. */
        JANUS_ERROR_JSEP_UNKNOWN_TYPE = 464,
        /*! \brief The Session Description provided by the peer is invalid */
        JANUS_ERROR_JSEP_INVALID_SDP = 465,
        /*! \brief The stream a trickle candidate for does not exist or is invalid */
        JANUS_ERROR_TRICKE_INVALID_STREAM = 466,
        /*! \brief A JSON element is of the wrong type (e.g., an integer instead of a string) */
        JANUS_ERROR_INVALID_ELEMENT_TYPE = 467,
        /*! \brief The ID provided to create a new session is already in use */
        JANUS_ERROR_SESSION_CONFLICT = 468,
        /*! \brief We got an ANSWER to an OFFER we never made */
        JANUS_ERROR_UNEXPECTED_ANSWER = 469
    }
}

