'use client';

import { useState, useEffect } from 'react';

interface Comment {
  id: string;
  user_id: string;
  username: string;
  comment_text: string;
  is_resolved: boolean;
  created_at: string;
  replies: Comment[];
}

interface CommentsPanelProps {
  workspaceId: string;
  entityType: string;
  entityId: string;
}

export default function CommentsPanel({
  workspaceId,
  entityType,
  entityId,
}: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [workspaceId, entityType, entityId]);

  const fetchComments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/comments/workspaces/${workspaceId}/comments?entity_type=${entityType}&entity_id=${entityId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setComments(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const addComment = async (parentId: string | null = null) => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/comments/workspaces/${workspaceId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            entity_type: entityType,
            entity_id: entityId,
            parent_comment_id: parentId,
            comment_text: newComment,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setNewComment('');
        setReplyingTo(null);
        fetchComments();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  const toggleResolve = async (commentId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/comments/comments/${commentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            is_resolved: !currentStatus,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        fetchComments();
      }
    } catch (error) {
      console.error('Failed to toggle resolve:', error);
    }
  };

  const renderComment = (comment: Comment, isReply: boolean = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-8 mt-3' : 'mt-4'}`}>
      <div className="card-minimal p-3">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-medium">
              {comment.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-white font-medium text-sm">{comment.username}</div>
              <div className="text-white/40 text-xs">
                {new Date(comment.created_at).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!isReply && (
              <button
                onClick={() => toggleResolve(comment.id, comment.is_resolved)}
                className={`px-2 py-1 text-xs rounded ${
                  comment.is_resolved
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/5 text-white/60'
                }`}
              >
                {comment.is_resolved ? 'Resolved' : 'Resolve'}
              </button>
            )}
          </div>
        </div>
        <p className="text-white/80 text-sm mb-2">{comment.comment_text}</p>
        {!isReply && (
          <button
            onClick={() => setReplyingTo(comment.id)}
            className="text-primary text-xs hover:underline"
          >
            Reply
          </button>
        )}
        {replyingTo === comment.id && (
          <div className="mt-3 space-y-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a reply..."
              rows={2}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={() => addComment(comment.id)}
                disabled={loading}
                className="px-3 py-1 bg-primary hover:bg-primary/80 text-black rounded text-sm font-medium transition-colors"
              >
                Reply
              </button>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setNewComment('');
                }}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {comment.replies && comment.replies.map((reply) => renderComment(reply, true))}
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Comments</h3>

      {/* New Comment Form */}
      <div className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
        />
        <button
          onClick={() => addComment()}
          disabled={loading || !newComment.trim()}
          className="px-4 py-2 bg-primary hover:bg-primary/80 text-black rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Posting...' : 'Post Comment'}
        </button>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-white/60 text-center py-8">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => renderComment(comment))
        )}
      </div>
    </div>
  );
}
