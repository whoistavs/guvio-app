import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  children: React.ReactNode;
  /** o que mostrar no lugar quando der erro; recebe o erro e uma função para tentar de novo */
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
  onError?: (error: Error) => void;
};

type State = { error: Error | null };

/** Segura erros de uma parte da tela para o app não fechar inteiro */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.retry);
      return (
        <View style={s.box}>
          <Text style={s.title}>Ops, algo deu errado</Text>
          <Text style={s.msg} numberOfLines={6}>
            {this.state.error.message}
          </Text>
          <Pressable onPress={this.retry} style={s.btn}>
            <Text style={s.btnText}>Tentar de novo</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  box: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  title: { fontSize: 18, fontWeight: "700", color: "#888" },
  msg: { fontSize: 12, color: "#888", textAlign: "center" },
  btn: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: "#888" },
  btnText: { color: "#FFF", fontWeight: "600" }
});
