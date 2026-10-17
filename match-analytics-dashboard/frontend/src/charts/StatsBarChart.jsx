import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const HOME_COLOR = '#7be0a4'
const AWAY_COLOR = '#f2b866'

export default function StatsBarChart({ data, homeName, awayName }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#22352f" vertical={false} />
          <XAxis dataKey="name" stroke="#8aa196" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis stroke="#8aa196" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(123,224,164,0.08)' }}
            contentStyle={{
              background: '#111c19',
              border: '1px solid #22352f',
              borderRadius: 8,
              color: '#e8f1ec',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#8aa196' }} />
          <Bar dataKey="home" name={homeName} fill={HOME_COLOR} radius={[3, 3, 0, 0]} />
          <Bar dataKey="away" name={awayName} fill={AWAY_COLOR} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
