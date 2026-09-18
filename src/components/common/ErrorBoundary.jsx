import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', background: '#ffebee', color: '#c62828', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>Doctor Dashboard Crashed!</h2>
          <p>Please share this error with the AI:</p>
          <pre style={{ background: '#ffcdd2', padding: '16px', borderRadius: '8px', overflowX: 'auto' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <pre style={{ background: '#ffcdd2', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginTop: '16px' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
