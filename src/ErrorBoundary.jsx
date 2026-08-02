import React from "react";

// Without this, an uncaught render error anywhere in the tree unmounts the
// whole app and leaves a blank white screen with no way back in for the
// user — this catches it and offers a reload instead.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled render error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            padding: "24px",
            textAlign: "center",
            fontFamily: "sans-serif",
            background: "#140F0B",
            color: "#F1EAD8",
          }}
        >
          <div style={{ fontSize: "40px" }}>🎱</div>
          <h1 style={{ fontSize: "18px", margin: 0 }}>Что-то пошло не так</h1>
          <p style={{ fontSize: "13.5px", opacity: 0.75, maxWidth: "320px", margin: 0 }}>
            Приложение столкнулось с непредвиденной ошибкой. Ваши данные сохранены на устройстве — перезагрузка
            обычно помогает.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              borderRadius: "10px",
              border: "none",
              background: "#C08A3E",
              color: "#2C1D08",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
