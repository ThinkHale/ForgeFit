import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { callClaude, buildCoachSystemPrompt } from '../../services/coach';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { ChatMessage } from '../../types';

const STAGE_LABEL: Record<string, string> = {
  new: 'New', building: 'Building', established: 'Established', deep: 'Deep bond',
};

const QUICK_PROMPTS = [
  { icon: '💪', label: 'Build my workout' },
  { icon: '🥗', label: 'Plan my meals' },
  { icon: '🔥', label: 'Motivate me' },
  { icon: '😓', label: 'Too hard, modify' },
  { icon: '💤', label: 'Recovery help' },
  { icon: '📊', label: 'Track progress' },
];

function TypingDots() {
  return (
    <View style={dotStyles.container}>
      {[0, 1, 2].map(i => (
        <View key={i} style={[dotStyles.dot, { opacity: 0.4 + i * 0.2 }]} />
      ))}
    </View>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[bubbleStyles.row, isUser && bubbleStyles.rowUser]}>
      {!isUser && (
        <LinearGradient
          colors={colors.gradients.brand as [string, string]}
          style={bubbleStyles.avatar}
        >
          <Text style={{ fontSize: 14 }}>⚡</Text>
        </LinearGradient>
      )}
      <View style={[
        bubbleStyles.bubble,
        isUser ? bubbleStyles.bubbleUser : bubbleStyles.bubbleAssistant,
      ]}>
        <Text style={[bubbleStyles.text, isUser && bubbleStyles.textUser]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

export default function CoachScreen({ route }: { route?: any }) {
  const { profile, chatMessages, isChatLoading, addChatMessage, setChatLoading, runMemoryExtraction, healthToday, nutritionToday } = useStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const userTurnCount = chatMessages.filter(m => m.role === 'user').length;

  useEffect(() => {
    const msg = route?.params?.initialMessage;
    if (msg) setInput(msg);
  }, [route?.params?.initialMessage]);

  // Initial greeting
  useEffect(() => {
    if (chatMessages.length === 0 && profile) {
      const greeting: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: profile.sessionCount === 0
          ? "Hey! I'm Forge, your AI training partner.\n\nI learn how you train, what motivates you, and get smarter every session. The more we work together, the better I get at coaching you specifically.\n\nWhat's your name?"
          : buildReturnGreeting(profile),
        timestamp: new Date().toISOString(),
      };
      addChatMessage(greeting);
    }
  }, [profile]);

  function buildReturnGreeting(p: typeof profile): string {
    if (!p) return 'Welcome back.';
    const name = p.name ?? 'you';
    if (p.lastSessionSummary) return `Good to have you back, ${name}.\n\nLast time, ${p.lastSessionSummary.toLowerCase()} What are we working on today?`;
    if (p.struggles.length) return `Welcome back, ${name}. Ready to tackle ${p.struggles[0]}? What's the focus today?`;
    return `Welcome back, ${name}. Ready to pick up where we left off?`;
  }

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [chatMessages, isChatLoading]);

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isChatLoading || !profile) return;
    setInput('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMsg);
    setChatLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const systemPrompt = buildCoachSystemPrompt(profile, healthToday ?? undefined, nutritionToday ?? undefined);
      const apiMessages = [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const reply = await callClaude(apiMessages, systemPrompt);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(assistantMsg);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Run memory extraction every 3 user turns
      const newCount = userTurnCount + 1;
      if (newCount % 3 === 0) {
        runMemoryExtraction();
      }
    } catch {
      addChatMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lost the connection for a second. Try that again.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setChatLoading(false);
    }
  }, [input, isChatLoading, chatMessages, profile, healthToday, nutritionToday, userTurnCount]);

  const bondPct = Math.min(100, ((profile?.sessionCount ?? 0) / 10) * 100);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={colors.gradients.brand as [string, string]}
            style={styles.coachIcon}
          >
            <Text style={{ fontSize: 18 }}>⚡</Text>
          </LinearGradient>
          <View>
            <Text style={styles.headerTitle}>Forge</Text>
            <View style={styles.headerSubRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerSub}>
                {STAGE_LABEL[profile?.relationshipStage ?? 'new']} · Session {(profile?.sessionCount ?? 0) + 1}
              </Text>
            </View>
          </View>
        </View>
        {/* Bond bar */}
        <View style={styles.bondContainer}>
          <View style={styles.bondTrack}>
            <LinearGradient
              colors={colors.gradients.brand as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.bondFill, { width: `${bondPct}%` as unknown as number }]}
            />
          </View>
          <Text style={styles.bondLabel}>{Math.round(bondPct)}%</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {chatMessages.map(m => <MessageBubble key={m.id} message={m} />)}
          {isChatLoading && (
            <View style={bubbleStyles.row}>
              <LinearGradient colors={colors.gradients.brand as [string, string]} style={bubbleStyles.avatar}>
                <Text style={{ fontSize: 14 }}>⚡</Text>
              </LinearGradient>
              <View style={bubbleStyles.bubbleAssistant}>
                <TypingDots />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick prompts */}
        {chatMessages.filter(m => m.role === 'user').length < 2 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
            {QUICK_PROMPTS.map((p) => (
              <TouchableOpacity
                key={p.label}
                onPress={() => send(p.label)}
                style={styles.quickChip}
              >
                <Text style={{ fontSize: 14 }}>{p.icon}</Text>
                <Text style={styles.quickChipText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={profile?.name ? `Message Forge, ${profile.name}...` : 'Message Forge...'}
            placeholderTextColor={colors.text.tertiary}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={!input.trim() || isChatLoading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={(input.trim() && !isChatLoading) ? colors.gradients.brand as [string, string] : ['#E5E5EA', '#E5E5EA']}
              style={styles.sendBtn}
            >
              {isChatLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.sendIcon}>↑</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.background.secondary },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.background.primary, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  headerLeft:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  coachIcon:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { ...typography.h4, color: colors.text.primary },
  headerSubRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  onlineDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  headerSub:     { ...typography.caption, color: colors.text.secondary },
  bondContainer: { alignItems: 'flex-end', gap: 2 },
  bondTrack:     { width: 80, height: 4, backgroundColor: colors.background.tertiary, borderRadius: 2, overflow: 'hidden' },
  bondFill:      { height: '100%', borderRadius: 2 },
  bondLabel:     { ...typography.label, color: colors.brand.primary },
  messages:      { flex: 1 },
  messagesContent: { padding: spacing.md, gap: 4 },
  quickScroll:   { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 56 },
  quickChip:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.background.primary, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border.light },
  quickChipText: { ...typography.smallMed, color: colors.text.primary },
  inputBar:      { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.lg, backgroundColor: colors.background.primary, borderTopWidth: 1, borderTopColor: colors.border.light },
  input:         { flex: 1, backgroundColor: colors.background.secondary, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, ...typography.body, color: colors.text.primary, maxHeight: 120 },
  sendBtn:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendIcon:      { fontSize: 20, color: '#fff', fontWeight: '700' },
});

const bubbleStyles = StyleSheet.create({
  row:             { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.sm },
  rowUser:         { justifyContent: 'flex-end' },
  avatar:          { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble:          { maxWidth: '75%', borderRadius: radius.xl, padding: spacing.sm + 2 },
  bubbleUser:      { backgroundColor: colors.brand.primary, borderBottomRightRadius: radius.sm },
  bubbleAssistant: { backgroundColor: colors.background.primary, borderBottomLeftRadius: radius.sm, ...shadows.sm },
  text:            { ...typography.body, color: colors.text.primary, lineHeight: 22 },
  textUser:        { color: '#fff' },
});

const dotStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text.tertiary },
});
