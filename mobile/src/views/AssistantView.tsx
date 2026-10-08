import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAssistantViewModel } from '../viewmodels/useAssistantViewModel';
import { ChatMessage } from '../models/Assistant';
import { StatusBadge } from '../components/ui';
import { makeStyles, radius, shadow, useTheme } from '../theme';

function toPlainMarkdown(text: string) {
  return text
    .replace(/^[ \t]*[*-][ \t]+/gm, '• ')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2');
}

function RichText({ text, style }: { text: string; style: object }) {
  const styles = useStyles();
  const parts = toPlainMarkdown(text).split(/\*\*(.+?)\*\*/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => (i % 2 === 1 ? <Text key={i} style={styles.bold}>{part}</Text> : part))}
    </Text>
  );
}

function BotAvatar() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.avatar}>
      <Ionicons name="sparkles" size={14} color={colors.onPrimary} />
    </View>
  );
}

export function AssistantView() {
  const { colors } = useTheme();
  const styles = useStyles();
  const vm = useAssistantViewModel();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const canSend = !!vm.input.trim() && !vm.sending;

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.row, isUser && styles.rowUser]}>
        {!isUser && <BotAvatar />}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble, item.error && styles.errorBubble]}>
          <RichText text={item.text} style={isUser ? styles.userText : styles.botText} />
          {item.demands?.map((demand) => (
            <Pressable
              key={demand.id}
              testID="assistant-demand-link"
              accessibilityRole="button"
              style={({ pressed }) => [styles.demandLink, pressed && styles.pressed]}
              onPress={() => vm.openDemand(demand.id)}
            >
              <View style={styles.demandInfo}>
                <Text style={styles.demandProtocol} numberOfLines={1}>{demand.protocolo}</Text>
                <StatusBadge status={demand.status} />
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable testID="assistant-clear" accessibilityRole="button" hitSlop={8} style={styles.clear} onPress={vm.clear}>
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={styles.clearText}>Limpar</Text>
            </Pressable>
          ),
        }}
      />

      <FlatList
        ref={listRef}
        testID="assistant-messages"
        data={vm.messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          <>
            {vm.sending && (
              <View style={styles.row}>
                <BotAvatar />
                <View style={[styles.bubble, styles.botBubble, styles.typing]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.typingText}>Consultando seus chamados…</Text>
                </View>
              </View>
            )}
            {vm.suggestions.length > 0 && (
              <View style={styles.suggestions}>
                {vm.suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                    onPress={() => vm.send(suggestion)}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.primary} />
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        }
      />

      <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
        <View style={styles.inputWrap}>
          <TextInput
            testID="assistant-input"
            style={styles.input}
            placeholder="Pergunte sobre seus chamados…"
            placeholderTextColor={colors.textSubtle}
            value={vm.input}
            onChangeText={vm.setInput}
            onSubmitEditing={() => vm.send()}
            returnKeyType="send"
            maxLength={1000}
            editable={!vm.sending}
          />
          <Pressable
            testID="assistant-send"
            accessibilityRole="button"
            accessibilityLabel="Enviar mensagem"
            style={[styles.sendButton, !canSend && styles.sendDisabled]}
            onPress={() => vm.send()}
            disabled={!canSend}
          >
            <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  rowUser: { justifyContent: 'flex-end' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.lg },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  botBubble: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, ...shadow(1) },
  errorBubble: { backgroundColor: colors.dangerSoft },
  userText: { color: colors.onPrimary, fontSize: 15, lineHeight: 21 },
  botText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  bold: { fontWeight: '700' },
  demandLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  demandInfo: { flex: 1, gap: 6 },
  demandProtocol: { fontWeight: '700', color: colors.text, fontSize: 14 },
  pressed: { opacity: 0.75 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { color: colors.textMuted },
  suggestions: { gap: 8, marginTop: 4, paddingLeft: 36 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  inputBar: { paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 5, minHeight: 50, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 10 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendDisabled: { backgroundColor: colors.textSubtle },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearText: { color: colors.primary, fontWeight: '700' },
}));
