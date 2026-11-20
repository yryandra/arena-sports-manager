export type Page = 'overview' | 'athletes' | 'competitions' | 'results' | 'schedule' | 'reports'
export type Resource = 'athletes' | 'events' | 'results'
export interface Athlete {
  _id: string
  name: string
  sport: string
  country: string
  age: number
  status: 'Active' | 'Inactive'
  createdAt: string
  updatedAt: string
}
export interface Competition {
  _id: string
  name: string
  sport: string
  discipline: string
  location: string
  date: string
  time: string
  status: 'Scheduled' | 'Live' | 'Completed'
  capacity: number
  unit: 's' | 'min' | 'm' | 'pts'
  ranking: 'asc' | 'desc'
  participants: string[]
  createdAt: string
  updatedAt: string
}
export interface Result {
  _id: string
  eventId: string
  athleteId: string
  performance: number
  status: 'Published' | 'Provisional'
  createdAt: string
  updatedAt: string
}
export interface Country {
  name: string
  code: string
  ioc: string
}
export interface Metadata {
  sports: string[]
  countries: Country[]
  mode: 'demo' | 'mongodb'
}
export type RecordData = Athlete | Competition | Result
export interface FormState {
  kind: Resource
  record?: RecordData
  eventId?: string
}
