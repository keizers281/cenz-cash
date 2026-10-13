const LEASE_MS = 90_000;
const MAX_ATTEMPTS = 5;
const DONE_RETENTION_MS = 60 * 60 * 1000;
const QUEUE_KEY = "queue";

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
	}

	async function verifySaweriaSignature(rawBody, signatureHeader, streamKey) {
		if (!streamKey) return true; // gak di-set = skip verifikasi (gampang buat testing)
			if (!signatureHeader) return false;

				const key = await crypto.subtle.importKey(
					"raw",
					new TextEncoder().encode(streamKey),
					{ name: "HMAC", hash: "SHA-256" },
					false,
					["sign"]
				);
				const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
				const hex = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");

				if (hex.length !== signatureHeader.length) return false;
					let diff = 0;
					for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
						return diff === 0;
						}

			async function loadQueue(env) {
				const raw = await env.DONATIONS.get(QUEUE_KEY);
				return raw ? JSON.parse(raw) : [];
				}

				async function saveQueue(env, items) {
					await env.DONATIONS.put(QUEUE_KEY, JSON.stringify(items));
					}

					async function pushItem(env, payload) {
						const items = await loadQueue(env);
						if (items.some((i) => i.id === payload.id)) {
							return { ok: true, deduped: true };
							}
							items.push({
								id: payload.id,
								amount_raw: payload.amount_raw,
								donator_name: payload.donator_name,
								message: payload.message,
								created_at: payload.created_at,
								status: "pending",
								leaseToken: null,
								leaseExpires: 0,
								attempts: 0,
								lastError: "",
							});
							await saveQueue(env, items);
							return { ok: true };
							}

						async function pullItems(env, limit) {
							const items = await loadQueue(env);
							const now = Date.now();
							let changed = false;

							for (const item of items) {
								if (item.status === "leased" && item.leaseExpires < now) {
									item.status = "pending";
									item.leaseToken = null;
									item.leaseExpires = 0;
									changed = true;
								}
								}

								const out = [];
								for (const item of items) {
									if (out.length >= limit) break;
									if (item.status !== "pending") continue;

										item.status = "leased";
										item.leaseToken = crypto.randomUUID();
										item.leaseExpires = now + LEASE_MS;
										item.attempts += 1;
										changed = true;

										out.push({
											id: item.id,
											leaseToken: item.leaseToken,
											amount: item.amount_raw,
											amount_raw: item.amount_raw,
											donator_name: item.donator_name,
											message: item.message,
											createdAt: item.created_at,
											created_at: item.created_at,
										});
										}

									if (changed) await saveQueue(env, items);
										return out;
										}

							async function ackItems(env, acks) {
								const items = await loadQueue(env);
								let changed = false;

								for (const ack of acks) {
									const item = items.find((i) => i.id === ack.id);
									if (!item) continue;
										if (item.leaseToken && ack.leaseToken && item.leaseToken !== ack.leaseToken) continue;

											if (ack.status === "done") {
												item.status = "done";
												item.doneAt = Date.now();
												} else {
	item.status = item.attempts >= MAX_ATTEMPTS ? "dead" : "pending";
	item.leaseToken = null;
	item.leaseExpires = 0;
	item.lastError = String(ack.error || "").slice(0, 250);
	}
	changed = true;
	}

	const cutoff = Date.now() - DONE_RETENTION_MS;
	const before = items.length;
	const filtered = items.filter((i) => !(i.status === "done" && i.doneAt < cutoff));
	if (filtered.length !== before) changed = true;

		if (changed) await saveQueue(env, filtered);
			}

			export default {
		async fetch(request, env) {
			const url = new URL(request.url);

			if (url.pathname === "/webhook" && request.method === "POST") {
				const rawBody = await request.text();
				const signature = request.headers.get("Saweria-Callback-Signature") || "";
				const valid = await verifySaweriaSignature(rawBody, signature, env.SAWERIA_STREAM_KEY);
				if (!valid) return json({ ok: false, error: "invalid_signature" }, 401);

					let payload;
					try {
						payload = JSON.parse(rawBody);
					} catch {
						return json({ ok: false, error: "bad_json" }, 400);
					}
					if (payload.type && payload.type !== "donation") {
						return json({ ok: true, skipped: true });
						}

						const result = await pushItem(env, {
							id: payload.id || crypto.randomUUID(),
							amount_raw: payload.amount_raw,
							donator_name: payload.donator_name,
							message: payload.message,
							created_at: payload.created_at,
						});
						return json(result);
						}

				if (url.pathname === "/api/pull" && request.method === "POST") {
					const body = await request.json().catch(() => ({}));
					const limit = Math.max(1, Math.min(25, Number(body.limit) || 10));
					const items = await pullItems(env, limit);
					return json({ ok: true, items });
					}

					if (url.pathname === "/api/ack" && request.method === "POST") {
						const body = await request.json().catch(() => ({}));
						const acks = Array.isArray(body.items) ? body.items : [];
						await ackItems(env, acks);
						return json({ ok: true });
						}

						if (url.pathname === "/debug/push" && request.method === "POST") {
							if (!env.DEBUG_TOKEN || request.headers.get("x-debug-token") !== env.DEBUG_TOKEN) {
								return json({ ok: false, error: "unauthorized" }, 401);
							}
							const payload = await request.json().catch(() => ({}));
							const result = await pushItem(env, {
								id: payload.id || crypto.randomUUID(),
								amount_raw: payload.amount_raw || 5000,
								donator_name: payload.donator_name || "Tester",
								message: payload.message || "test donasi",
								created_at: new Date().toISOString(),
							});
							return json(result);
							}

							if (url.pathname === "/admin/retry" && request.method === "POST") {
								if (!env.DEBUG_TOKEN || request.headers.get("x-debug-token") !== env.DEBUG_TOKEN) {
									return json({ ok: false, error: "unauthorized" }, 401);
								}
								const body = await request.json().catch(() => ({}));
								const items = await loadQueue(env);
								const item = items.find((i) => i.id === body.id);
								if (!item) return json({ ok: false, error: "not_found" }, 404);
									item.status = "pending";
									item.leaseToken = null;
									item.leaseExpires = 0;
									item.attempts = 0;
									item.lastError = "";
									await saveQueue(env, items);
									return json({ ok: true });
									}

								if (url.pathname === "/admin/delete" && request.method === "POST") {
									if (!env.DEBUG_TOKEN || request.headers.get("x-debug-token") !== env.DEBUG_TOKEN) {
										return json({ ok: false, error: "unauthorized" }, 401);
									}
									const body = await request.json().catch(() => ({}));
									const items = await loadQueue(env);
									const filtered = items.filter((i) => i.id !== body.id);
									await saveQueue(env, filtered);
									return json({ ok: true, removed: filtered.length !== items.length });
									}

									if (url.pathname === "/debug/queue" && request.method === "GET") {
										if (!env.DEBUG_TOKEN || request.headers.get("x-debug-token") !== env.DEBUG_TOKEN) {
											return json({ ok: false, error: "unauthorized" }, 401);
										}
										const items = await loadQueue(env);
										return json({ ok: true, count: items.length, items });
										}

										if (url.pathname === "/health") {
											return json({ ok: true, service: "zyron-donate-real-worker" });
											}

											return json({ ok: false, error: "not_found" }, 404);
		},
	};
