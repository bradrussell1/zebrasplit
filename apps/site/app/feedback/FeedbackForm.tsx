"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabase";
import s from "./feedback.module.css";

/**
 * Email, title, description, send.
 *
 * The write goes through the submit_feedback RPC rather than an insert, so the
 * page cannot set a status, attach someone else's account, or backdate a row.
 * A signed-in visitor's address is read from their account server-side; this
 * form is for everyone else, so it asks.
 */
type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

function friendly(message: string): string {
  if (/email address we can reply to/i.test(message)) return "That email address doesn't look right. We need somewhere to reply.";
  if (/title and a description/i.test(message)) return "Add a title and a description.";
  if (/fetch|network/i.test(message)) return "Couldn't reach us. Check your connection and try again.";
  return message;
}

export function FeedbackForm() {
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "sending" });
    try {
      const { error } = await supabaseBrowser().rpc("submit_feedback", {
        p_title: title,
        p_body: body,
        p_email: email,
        p_platform: "web",
        p_app_version: null,
      });
      if (error) { setState({ kind: "error", message: friendly(error.message) }); return; }
      setState({ kind: "sent" });
    } catch (err) {
      setState({ kind: "error", message: friendly(err instanceof Error ? err.message : String(err)) });
    }
  }

  if (state.kind === "sent") {
    return (
      <div className={s.done} role="status">
        <h2 className={s.doneTitle}>Got it, thank you.</h2>
        <p className={s.doneBody}>A real person reads these. If it needs a reply, it goes to {email}.</p>
        <Button variant="secondary" onClick={() => { setTitle(""); setBody(""); setState({ kind: "idle" }); }}>Send another</Button>
      </div>
    );
  }

  const sending = state.kind === "sending";
  return (
    <form className={s.form} onSubmit={send} noValidate>
      <div className={s.field}>
        <label className={s.label} htmlFor="fb-email">Your email</label>
        <input
          id="fb-email" className={s.input} type="email" value={email} required
          autoComplete="email" placeholder="you@example.com" disabled={sending}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className={s.hint}>So we can reply. Nothing else.</p>
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="fb-title">Title</label>
        <input
          id="fb-title" className={s.input} type="text" value={title} required maxLength={120}
          placeholder="Receipt scan missed the tip" disabled={sending}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="fb-body">Description</label>
        <textarea
          id="fb-body" className={s.textarea} value={body} required rows={7} maxLength={4000}
          placeholder="What happened, and what you expected instead." disabled={sending}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className={s.hint}>{body.length} of 4000</p>
      </div>

      {state.kind === "error" ? <p className={s.error} role="alert">{state.message}</p> : null}

      <Button type="submit" variant="primary" size="lg" disabled={sending}>
        {sending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
