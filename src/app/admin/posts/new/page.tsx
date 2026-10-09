import { createPostAction } from "../actions";
import { PostForm } from "../post-form";

export const metadata = { title: "Admin · New post" };

export default function NewPostPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">New post</h1>
      <PostForm action={createPostAction} submitLabel="Create and add media" />
    </div>
  );
}
