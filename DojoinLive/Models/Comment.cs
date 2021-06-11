using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DojoinLive.Models
{
    public class Comment
    {
        public string ViewerName { get; set; }
        public string LiveConnectionId { get; set; }
        public string CommentString { get; set; }
        public string TimeStampString { get; set; }
        public DateTime TimeStamp { get; set; }

        public static readonly List<Comment> comments = new List<Comment>();

        public static List<Comment> GetComments(string liveConnectionId)
        {
            return Comment.comments.FindAll(c => c.LiveConnectionId == liveConnectionId).OrderByDescending(t => t.TimeStamp).ToList();
        }
    }
}
