import { useState } from 'react';
import { MessageSquare, Send, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useOrgChartStore } from '../../stores/orgChartStore';
import { interpretCommand, isDestructiveCommand } from '../../services/claudeCommandService';
import { executeCommand, getCommandPreview } from '../../services/commandExecutor';
import CommandPreview from './CommandPreview';
import './CommandInput.css';

/**
 * CommandInput - Natural language command input for org chart modifications
 */
function CommandInput() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [command, setCommand] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | processing | previewing | executing | complete
  const [parsedCommand, setParsedCommand] = useState(null);
  const [preview, setPreview] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message }
  const [error, setError] = useState(null);

  // Get store state for context
  const storeState = useOrgChartStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!command.trim() || phase === 'processing') return;

    setPhase('processing');
    setError(null);
    setFeedback(null);

    try {
      // Call Claude to interpret the command
      const result = await interpretCommand(command.trim(), storeState);

      if (!result.success) {
        setError(result.error);
        if (result.suggestions) {
          setError(`${result.error}\n\nSuggestions:\n${result.suggestions.map(s => `- ${s}`).join('\n')}`);
        }
        setPhase('idle');
        return;
      }

      // Store the parsed command
      setParsedCommand(result.command);

      // Get preview information
      const commandPreview = getCommandPreview(result.command);
      setPreview(commandPreview);

      // If destructive, show confirmation modal
      if (isDestructiveCommand(result.command.type)) {
        setPhase('previewing');
      } else {
        // Non-destructive commands also show preview for confirmation
        setPhase('previewing');
      }
    } catch (err) {
      setError(err.message);
      setPhase('idle');
    }
  };

  const handleConfirm = async () => {
    if (!parsedCommand) return;

    setPhase('executing');

    try {
      const result = executeCommand(parsedCommand);

      setFeedback({
        type: result.success ? 'success' : 'error',
        message: result.message
      });

      // Reset state after success
      if (result.success) {
        setCommand('');
        setParsedCommand(null);
        setPreview(null);
      }

      setPhase('complete');

      // Auto-dismiss feedback after 5 seconds
      setTimeout(() => {
        setFeedback(null);
        setPhase('idle');
      }, 5000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message
      });
      setPhase('complete');
    }
  };

  const handleCancel = () => {
    setParsedCommand(null);
    setPreview(null);
    setPhase('idle');
  };

  const handleClear = () => {
    setCommand('');
    setError(null);
    setFeedback(null);
    setParsedCommand(null);
    setPreview(null);
    setPhase('idle');
  };

  const dismissFeedback = () => {
    setFeedback(null);
    if (phase === 'complete') {
      setPhase('idle');
    }
  };

  if (!isExpanded) {
    return (
      <button
        className="command-input-toggle"
        onClick={() => setIsExpanded(true)}
        title="Natural language commands"
      >
        <MessageSquare size={18} />
        <span>AI Commands</span>
      </button>
    );
  }

  return (
    <>
      <div className="command-input-container">
        <form onSubmit={handleSubmit} className="command-input-form">
          <div className="command-input-wrapper">
            <MessageSquare size={18} className="command-icon" />
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Type a command... (e.g., 'Add a VP of Engineering')"
              disabled={phase === 'processing' || phase === 'executing'}
              autoFocus
            />
            {command && (
              <button
                type="button"
                className="clear-button"
                onClick={handleClear}
                disabled={phase === 'processing' || phase === 'executing'}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="submit-button"
            disabled={!command.trim() || phase === 'processing' || phase === 'executing'}
          >
            {phase === 'processing' ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
          <button
            type="button"
            className="collapse-button"
            onClick={() => setIsExpanded(false)}
            title="Close"
          >
            <X size={18} />
          </button>
        </form>

        {phase === 'processing' && (
          <div className="command-status processing">
            <Loader2 size={16} className="spin" />
            <span>Understanding command...</span>
          </div>
        )}

        {error && (
          <div className="command-status error">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {feedback && (
          <div className={`command-status ${feedback.type}`}>
            {feedback.type === 'success' ? (
              <CheckCircle size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{feedback.message}</span>
            <button onClick={dismissFeedback}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      <CommandPreview
        isOpen={phase === 'previewing' || phase === 'executing'}
        preview={preview}
        isExecuting={phase === 'executing'}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

export default CommandInput;
