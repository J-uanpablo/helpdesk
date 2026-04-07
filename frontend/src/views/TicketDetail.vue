<template>
  <!-- ...tu UI del ticket... -->

  <TicketSatisfactionModal
    :open="showSatisfaction"
    :ticketId="ticket?.id ?? 0"
    @close="showSatisfaction = false"
    @submitted="onSatisfactionSubmitted"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import TicketSatisfactionModal from '../components/tickets/TicketSatisfactionModal.vue';

const route = useRoute();
const ticket = ref<any>(null);
const showSatisfaction = ref(false);

function getToken() {
  return localStorage.getItem('token') || '';
}

async function loadTicket() {
  const token = getToken();
  const { data } = await axios.get(`/tickets/${Number(route.params.id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('TICKET:', data);

  ticket.value = data;

  const isClosed = data?.status === 'CLOSED';
  const notRated = !data?.satisfaction;

  showSatisfaction.value = isClosed && notRated;

  console.log('SHOW SATISFACTION?', showSatisfaction.value, {
    status: data?.status,
    satisfaction: data?.satisfaction,
  });
}

async function onSatisfactionSubmitted() {
  showSatisfaction.value = false;
  await loadTicket();
}

onMounted(loadTicket);
</script>
