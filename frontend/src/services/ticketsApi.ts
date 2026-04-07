// src/services/ticketsApi.ts
import axios from 'axios';

function getToken() {
  return localStorage.getItem('token') || '';
}

export async function submitTicketSatisfaction(
  ticketId: number,
  payload: { rating: number; comment?: string }
) {
  const token = getToken();
  const { data } = await axios.post(`/tickets/${ticketId}/satisfaction`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
}

export async function getTicketSatisfaction(ticketId: number) {
  const token = getToken();
  const { data } = await axios.get(`/tickets/${ticketId}/satisfaction`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data; // { rating, comment, createdAt } | null
}
