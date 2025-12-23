import { Calendar } from 'lucide-react';
import { useOrgChartStore } from '../../stores/orgChartStore';
import { getPersonCountsByQuarter } from '../../utils/roleExpander';
import './QuarterSelector.css';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'Full Year'];

function QuarterSelector() {
  const { selectedQuarter, setSelectedQuarter, roleTemplates } = useOrgChartStore();

  const personCounts = roleTemplates.length > 0
    ? getPersonCountsByQuarter(roleTemplates)
    : {};

  return (
    <div className="quarter-selector">
      <label>
        <Calendar size={16} />
        <span>Select Quarter</span>
      </label>

      <select
        value={selectedQuarter}
        onChange={(e) => setSelectedQuarter(e.target.value)}
        className="quarter-dropdown"
      >
        {QUARTERS.map(quarter => (
          <option key={quarter} value={quarter}>
            {quarter} {personCounts[quarter] ? `(${personCounts[quarter]} people)` : ''}
          </option>
        ))}
      </select>

      {personCounts[selectedQuarter] && (
        <div className="quarter-info">
          <span className="quarter-badge">
            {personCounts[selectedQuarter]} person nodes active
          </span>
        </div>
      )}
    </div>
  );
}

export default QuarterSelector;
