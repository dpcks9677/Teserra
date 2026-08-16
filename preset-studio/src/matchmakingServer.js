import {
  areTicketsCompatible,
  isValidRatingBound,
  normalizeRatingBound
} from "./matchmakingRules.js";
import { verifyFirebaseIdToken } from "./firebaseToken.js";

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export default class MatchmakingServer {
  constructor(room) {
    this.room = room;
    this.tickets = new Map();
    this.matches = new Map();
    this.pendingEnqueues = new Map();
  }

  onConnect(connection) {
    console.info('[matchmaking] connect', { connectionId: connection.id });
    connection.send(JSON.stringify({ type: "matchmaking_ready" }));
  }

  onClose(connection) {
    this.cancelTicket(connection.id);
    const match = [...this.matches.values()]
      .find((candidate) => candidate.connectionIds.includes(connection.id));
    if (!match?.startedConnectionIds.has(connection.id)) {
      this.cancelMatch(connection.id, "상대 연결이 종료됨.");
    }
  }

  async onMessage(message, connection) {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      connection.send(JSON.stringify({ type: "error", message: "잘못된 요청임." }));
      return;
    }

    if (data.type === "enqueue") {
      await this.enqueue(connection, data);
    } else if (data.type === "cancel_queue") {
      this.cancelTicket(connection.id);
      connection.send(JSON.stringify({ type: "queue_cancelled" }));
    } else if (data.type === "cancel_match") {
      this.cancelMatch(connection.id, "상대가 매칭을 취소함.");
    } else if (data.type === "match_started") {
      this.finishMatchmaking(connection.id);
    }
  }

  async enqueue(connection, data) {
    console.info('[matchmaking] enqueue_request', {
      connectionId: connection.id,
      mode: data.mode === 'augmented' ? 'augmented' : 'normal',
      lower: data.lower ?? 'unlimited',
      upper: data.upper ?? 'unlimited'
    });
    const mode = data.mode === "augmented" ? "augmented" : "normal";
    if (
      !isValidRatingBound(data.lower)
      || !isValidRatingBound(data.upper)
      || (
        normalizeRatingBound(data.lower) !== null
        && normalizeRatingBound(data.upper) !== null
        && normalizeRatingBound(data.lower) > normalizeRatingBound(data.upper)
      )
    ) {
      connection.send(JSON.stringify({ type: "error", message: "레이팅 검색 범위가 올바르지 않음." }));
      return;
    }

    const requestId = crypto.randomUUID();
    this.pendingEnqueues.set(connection.id, requestId);
    let profile;
    try {
      profile = await this.loadProfile(data.idToken, mode);
    } catch (error) {
      if (this.pendingEnqueues.get(connection.id) === requestId) {
        this.pendingEnqueues.delete(connection.id);
        connection.send(JSON.stringify({ type: "error", message: error.message || "레이팅 정보를 확인할 수 없음." }));
      }
      return;
    }
    if (this.pendingEnqueues.get(connection.id) !== requestId) return;
    this.pendingEnqueues.delete(connection.id);

    if ([...this.matches.values()].some((match) => match.playerUids.includes(profile.uid))) {
      connection.send(JSON.stringify({ type: "error", message: "이미 확정된 온라인 매치가 있음." }));
      return;
    }

    for (const [id, ticket] of this.tickets) {
      if (ticket.uid === profile.uid) this.tickets.delete(id);
    }

    const ticket = {
      connection,
      connectionId: connection.id,
      ticketId: makeId("ticket"),
      uid: profile.uid,
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl,
      mode,
      rating: profile.rating,
      ratingGames: profile.ratingGames,
      lower: normalizeRatingBound(data.lower),
      upper: normalizeRatingBound(data.upper),
      queuedAt: Date.now()
    };
    this.tickets.set(connection.id, ticket);
    console.info('[matchmaking] queue_joined', {
      connectionId: connection.id,
      uid: ticket.uid,
      mode: ticket.mode,
      rating: ticket.rating,
      lower: ticket.lower,
      upper: ticket.upper,
      poolSize: this.tickets.size
    });
    connection.send(JSON.stringify({ type: "queue_joined", ticketId: ticket.ticketId }));
    this.tryMatch(ticket);
  }

  async loadProfile(idToken, mode) {
    if (this.room.env?.DB) {
      const decoded = await verifyFirebaseIdToken(idToken);
      const column = mode === 'augmented' ? 'augmented' : 'normal';
      const result = await this.room.env.DB.prepare(
        `SELECT uid, nickname, avatar_url, ${column}_rating AS rating, ${column}_games AS ratingGames FROM users WHERE uid = ?`
      ).bind(decoded.sub).first();
      if (!result) throw new Error('USER_NOT_FOUND');
      return {
        uid: String(result.uid),
        nickname: String(result.nickname || 'Player').slice(0, 24),
        avatarUrl: result.avatar_url || null,
        rating: Number(result.rating),
        ratingGames: Math.max(0, Number(result.ratingGames) || 0)
      };
    }
    const url = this.room.env?.MATCHMAKING_PROFILE_URL;
    const secret = "internal-auth";
    if (!url || !secret || !idToken) throw new Error("매치메이킹 인증 설정이 필요함.");
    const response = await fetch(String(url), {
      method: "POST",
      headers: {
        authorization: `Bearer ${idToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ mode })
    });
    if (!response.ok) throw new Error("로그인 또는 레이팅 정보를 확인할 수 없음.");
    const profile = await response.json();
    const rating = Number(profile.rating);
    if (!profile.uid || !Number.isFinite(rating) || rating < 0) {
      throw new Error("레이팅 응답이 올바르지 않음.");
    }
    return {
      uid: String(profile.uid),
      nickname: String(profile.nickname || "Player").slice(0, 24),
      avatarUrl: profile.avatarUrl || null,
      rating,
      ratingGames: Math.max(0, Number(profile.ratingGames) || 0)
    };
  }

  tryMatch(ticket) {
    const placement = ticket.ratingGames < 10;
    const opponent = [...this.tickets.values()]
      .filter((candidate) => candidate.connectionId !== ticket.connectionId)
      .sort((a, b) => (
        Number((a.ratingGames < 10) !== placement)
        - Number((b.ratingGames < 10) !== placement)
        || a.queuedAt - b.queuedAt
      ))
      .find((candidate) => areTicketsCompatible(ticket, candidate));
    if (!opponent) {
      console.info('[matchmaking] waiting', { connectionId: ticket.connectionId, poolSize: this.tickets.size });
      return;
    }

    this.tickets.delete(ticket.connectionId);
    this.tickets.delete(opponent.connectionId);

    const matchId = makeId("match");
    const roomId = makeId("online");
    const matchToken = crypto.randomUUID();
    const match = {
      matchId,
      roomId,
      matchToken,
      playerUids: [ticket.uid, opponent.uid],
      connections: [ticket.connection, opponent.connection],
      connectionIds: [ticket.connectionId, opponent.connectionId],
      startedConnectionIds: new Set()
    };
    this.matches.set(matchId, match);
    console.info('[matchmaking] match_found', { matchId, mode: ticket.mode, poolSize: this.tickets.size });
    const startsAt = Date.now() + 3000;

    const send = (player, other) => player.connection.send(JSON.stringify({
      type: "match_found",
      matchId,
      roomId,
      matchToken,
      mode: player.mode,
      startsAt,
      opponent: {
        nickname: other.nickname,
        avatarUrl: other.avatarUrl
      }
    }));
    send(ticket, opponent);
    send(opponent, ticket);
  }

  cancelTicket(connectionId) {
    this.pendingEnqueues.delete(connectionId);
    this.tickets.delete(connectionId);
  }

  cancelMatch(connectionId, reason) {
    const entry = [...this.matches.entries()]
      .find(([, match]) => match.connectionIds.includes(connectionId));
    if (!entry) return;
    const [matchId, match] = entry;
    this.matches.delete(matchId);
    for (const connection of match.connections) {
      try {
        connection.send(JSON.stringify({ type: "match_cancelled", reason }));
      } catch {}
    }
  }

  finishMatchmaking(connectionId) {
    const entry = [...this.matches.entries()]
      .find(([, match]) => match.connectionIds.includes(connectionId));
    if (!entry) return;
    const [matchId, match] = entry;
    match.startedConnectionIds.add(connectionId);
    if (match.startedConnectionIds.size === match.connectionIds.length) {
      this.matches.delete(matchId);
    }
  }
}
