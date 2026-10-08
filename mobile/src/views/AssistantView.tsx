import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistantViewModel } from '../viewmodels/useAssistantViewModel';
import { ChatMessage } from '../models/Assistant';
import { STATUS_COLORS } from '../models/Demand';

function toPlainMarkdown(text: string) {
  return text
    .replace(/^[ \t]*[*-][ \t]+/gm, '• ')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2');
}

function RichText({ text, style }: { text: string; style: object }) {
  const parts = toPlainMarkdown(text).split(/\*\*(.+?)\*\*/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => (i % 2 === 1 ? <Text key={i} style={styles.bold}>{part}</Text> : part))}
    </Text>
  );
}

export function AssistantView() {
  const vm = useAssistantViewModel();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble, item.error && styles.errorBubble]}>
        <RichText text={item.text} style={isUser ? styles.userText : styles.botText} />
        {item.demands?.map((demand) => (
          <TouchableOpacity
            key={demand.id}
            testID="assistant-demand-link"
            accessibilityRole="button"
            style={styles.demandLink}
            onPress={() => vm.openDemand(demand.id)}
          >
            <Text style={styles.demandProtocol}>{demand.protocolo}</Text>
            <Text style={[styles.demandStatus, { color: STATUS_COLORS[demand.status] ?? '#666' }]}>{demand.status}</Text>
            <Text style={styles.demandOpen}>Abrir ›</Text>
          </TouchableOpacity>
        ))}
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
            <TouchableOpacity testID="assistant-clear" accessibilityRole="button" onPress={vm.clear}>
              <Text style={styles.clearText}>Limpar</Text>
            </TouchableOpacity>
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
              <View style={[styles.bubble, styles.botBubble, styles.typing]}>
                <ActivityIndicator size="small" color="#007BFF" />
                <Text style={styles.typingText}>Consultando seus chamados…</Text>
              </View>
            )}
            {vm.suggestions.length > 0 && (
              <View style={styles.suggestions}>
                {vm.suggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    accessibilityRole="button"
                    style={styles.suggestion}
                    onPress={() => vm.send(suggestion)}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        }
      />

      <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
        <TextInput
          testID="assistant-input"
          style={styles.input}
          placeholder="Pergunte sobre seus chamados…"
          value={vm.input}
          onChangeText={vm.setInput}
          onSubmitEditing={() => vm.send()}
          returnKeyType="send"
          maxLength={1000}
          editable={!vm.sending}
        />
        <TouchableOpacity
          testID="assistant-send"
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem"
          style={[styles.sendButton, (!vm.input.trim() || vm.sending) && styles.sendDisabled]}
          onPress={() => vm.send()}
          disabled={!vm.input.trim() || vm.sending}
        >
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 15, paddingBottom: 20 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 14, marginBottom: 10 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#007BFF', borderBottomRightRadius: 4 },
  botBubble: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, elevation: 1 },
  errorBubble: { backgroundColor: '#FDECEA' },
  userText: { color: '#fff', fontSize: 15 },
  botText: { color: '#333', fontSize: 15, lineHeight: 21 },
  bold: { fontWeight: 'bold' },
  demandLink: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F0F6FF', gap: 8 },
  demandProtocol: { fontWeight: 'bold', color: '#333', flexShrink: 1 },
  demandStatus: { fontWeight: '600', flex: 1 },
  demandOpen: { color: '#007BFF', fontWeight: 'bold' },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { color: '#666' },
  suggestions: { gap: 8, marginTop: 4 },
  suggestion: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#007BFF' },
  suggestionText: { color: '#007BFF' },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', gap: 8 },
  input: { flex: 1, backgroundColor: '#f5f5f5', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, fontSize: 15 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007BFF', justifyContent: 'center', alignItems: 'center' },
  sendDisabled: { backgroundColor: '#9CC8FF' },
  sendText: { color: '#fff', fontSize: 18 },
  clearText: { color: '#007BFF', fontWeight: 'bold' },
});
