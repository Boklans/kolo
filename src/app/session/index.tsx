import React from 'react';
import { Redirect } from 'expo-router';

export default function SessionIndexRedirect() {
  return <Redirect href="/session/orchestrator" />;
}
