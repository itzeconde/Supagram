"use client";

import { useEffect, useState } from "react";
import PostCard from "./components/PostCard";
import { supabase } from "./lib/supabase";
import { Post } from "./types";

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Usuario autenticado
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const handleLike = (postId: number | string) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes_count: post.isLiked
                ? post.likes_count - 1
                : post.likes_count + 1,
            }
          : post
      )
    );
  };

  const handleComment = async (postId: number | string, body: string) => {
    if (!currentUserId) return;

    const { data: newComment, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, user_id: currentUserId, body })
      .select()
      .single();

    if (error || !newComment) {
      console.error("Error al publicar el comentario:", error);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", currentUserId)
      .single();

    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [
                ...(post.comments ?? []),
                { ...newComment, profile: profile ?? undefined },
              ],
            }
          : post
      )
    );
  };

  useEffect(() => {
    const fetchPosts = async () => {
      // 1. Obtener posts
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (postsError || !postsData) {
        console.error("Error al obtener los posts:", postsError);
        return;
      }

      // 2. Obtener comentarios de esos posts
      const postIds = postsData.map((p) => p.id);
      const { data: commentsData } = await supabase
        .from("comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });

      // 3. IDs únicos de usuarios (autores de posts y de comentarios)
      const userIds = [
        ...new Set([
          ...postsData.map((p) => p.user_id),
          ...(commentsData?.map((c) => c.user_id) ?? []),
        ]),
      ];

      // 4. Buscar profiles de esos usuarios
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      // 5. Mapa de profiles por ID
      const profilesMap = new Map(
        profilesData?.map((p) => [
          p.id,
          { username: p.username, avatar_url: p.avatar_url },
        ]) || []
      );

      // 6. Combinar posts + profiles + comentarios
      const postsWithProfiles: Post[] = postsData.map((post) => ({
        ...post,
        likes_count: post.likes ?? 0,
        profile: profilesMap.get(post.user_id),
        comments: (commentsData ?? [])
          .filter((c) => c.post_id === post.id)
          .map((c) => ({ ...c, profile: profilesMap.get(c.user_id) })),
      }));

      setPosts(postsWithProfiles);
    };

    fetchPosts();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card-bg border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center">
          <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">
            Supagram
          </h1>
        </div>
      </header>

      {/* Feed de posts */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onLike={handleLike}
              onComment={handleComment}
            />
          ))}
        </div>
      </main>
    </div>
  );
}