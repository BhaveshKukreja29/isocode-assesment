import { NavLink, Route, Routes } from 'react-router'
import { Cities } from './Cities'
import { Models } from './Models'
import { Prices } from './Prices'
import { UsedStock } from './UsedStock'
import { Users } from './Users'
import s from './Admin.module.css'

const TABS = [
  ['', 'Price table'],
  ['cities', 'Cities & tax'],
  ['models', 'Models'],
  ['used', 'Used stock'],
  ['users', 'Users & roles'],
] as const

export default function Admin() {
  return (
    <div className={s.page}>
      <title>Admin · Company A</title>
      <nav className={s.tabs} aria-label="Admin sections">
        {TABS.map(([path, label]) => (
          <NavLink key={path} to={path ? `/admin/${path}` : '/admin'} end className={s.tab}>
            {label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Prices />} />
        <Route path="cities" element={<Cities />} />
        <Route path="models" element={<Models />} />
        <Route path="used" element={<UsedStock />} />
        <Route path="users" element={<Users />} />
      </Routes>
    </div>
  )
}
