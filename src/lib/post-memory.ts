import type { Post } from '@/types';
let owner: string | null = null;
const posts = new Map<string, Post>();
export const postMemory = {
  setAccount(id: string | null) {
    if (id !== owner) {
      owner = id;
      posts.clear();
    }
  },
  put(post: Post) {
    if (!owner) return;
    posts.delete(post.id);
    posts.set(post.id, post);
    if (posts.size > 120) posts.delete(posts.keys().next().value!);
  },
  get(id: string) {
    return posts.get(id) || null;
  },
  update(id: string, updates: Partial<Post>) {
    const post = posts.get(id);
    if (post) posts.set(id, { ...post, ...updates });
  },
  remove(id: string) {
    posts.delete(id);
  },
};
