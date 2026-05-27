import React from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';

interface PortalChartsProps {
  data: any[];
  dataKey: string;
  stroke: string;
}

export const PortalCharts: React.FC<PortalChartsProps> = ({
  data,
  dataKey,
  stroke,
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={stroke}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default PortalCharts;
