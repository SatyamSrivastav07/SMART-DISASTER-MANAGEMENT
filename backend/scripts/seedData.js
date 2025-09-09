const mongoose = require('mongoose');
const { initializeSensors } = require('../utils/sensorSimulator');
const Team = require('../models/Team');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/disaster-response', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const seedTeams = async () => {
  try {
    const existingTeams = await Team.countDocuments();
    
    if (existingTeams === 0) {
      const defaultTeams = [
        {
          teamId: 'fire-alpha-001',
          name: 'Fire Department Alpha',
          type: 'fire',
          status: 'available',
          location: {
            base: 'Ghaziabad Fire Station 1',
            current: {
              address: 'Ghaziabad Fire Station 1',
              coordinates: { lat: 28.6692, lng: 77.4538 }
            }
          },
          members: [
            { name: 'Rajesh Kumar', role: 'Fire Captain', isLeader: true, contactNumber: '+91-9876543210' },
            { name: 'Amit Singh', role: 'Firefighter', contactNumber: '+91-9876543211' },
            { name: 'Suresh Gupta', role: 'Firefighter', contactNumber: '+91-9876543212' },
            { name: 'Ravi Sharma', role: 'Driver', contactNumber: '+91-9876543213' }
          ],
          equipment: [
            { item: 'Fire Engine', quantity: 1, status: 'operational' },
            { item: 'Water Hoses', quantity: 6, status: 'operational' },
            { item: 'Breathing Apparatus', quantity: 8, status: 'operational' }
          ],
          specializations: ['structural fires', 'vehicle fires', 'hazmat response'],
          contact: {
            primaryPhone: '+91-9876543210',
            radio: 'FIRE-ALPHA-1',
            email: 'fire.alpha@ghaziabad.gov.in'
          }
        },
        {
          teamId: 'medical-bravo-001',
          name: 'Medical Emergency Team Bravo',
          type: 'medical',
          status: 'available',
          location: {
            base: 'Ghaziabad District Hospital',
            current: {
              address: 'Ghaziabad District Hospital',
              coordinates: { lat: 28.6650, lng: 77.4600 }
            }
          },
          members: [
            { name: 'Dr. Priya Sharma', role: 'Emergency Physician', isLeader: true, contactNumber: '+91-9876543220' },
            { name: 'Nurse Sunita Devi', role: 'Critical Care Nurse', contactNumber: '+91-9876543221' },
            { name: 'Paramedic Vikash', role: 'Paramedic', contactNumber: '+91-9876543222' },
            { name: 'Driver Ramesh', role: 'Ambulance Driver', contactNumber: '+91-9876543223' }
          ],
          equipment: [
            { item: 'Ambulance', quantity: 1, status: 'operational' },
            { item: 'Defibrillator', quantity: 1, status: 'operational' },
            { item: 'Medical Supplies', quantity: 1, status: 'operational' }
          ],
          specializations: ['trauma care', 'cardiac emergencies', 'mass casualties'],
          contact: {
            primaryPhone: '+91-9876543220',
            radio: 'MED-BRAVO-1',
            email: 'medical.bravo@ghaziabad.gov.in'
          }
        },
        {
          teamId: 'rescue-charlie-001',
          name: 'Search & Rescue Charlie',
          type: 'rescue',
          status: 'available',
          location: {
            base: 'Civil Defense Office',
            current: {
              address: 'Civil Defense Office, Ghaziabad',
              coordinates: { lat: 28.6700, lng: 77.4500 }
            }
          },
          members: [
            { name: 'Inspector Manoj Kumar', role: 'Rescue Team Leader', isLeader: true, contactNumber: '+91-9876543230' },
            { name: 'Constable Deepak', role: 'Rescue Specialist', contactNumber: '+91-9876543231' },
            { name: 'Constable Ajay', role: 'Rescue Specialist', contactNumber: '+91-9876543232' },
            { name: 'Volunteer Rohit', role: 'Support Staff', contactNumber: '+91-9876543233' }
          ],
          equipment: [
            { item: 'Rescue Vehicle', quantity: 1, status: 'operational' },
            { item: 'Rope Equipment', quantity: 1, status: 'operational' },
            { item: 'Cutting Tools', quantity: 1, status: 'operational' }
          ],
          specializations: ['building collapse', 'confined space', 'water rescue'],
          contact: {
            primaryPhone: '+91-9876543230',
            radio: 'RESCUE-CHARLIE-1',
            email: 'rescue.charlie@ghaziabad.gov.in'
          }
        },
        {
          teamId: 'police-delta-001',
          name: 'Police Emergency Response Delta',
          type: 'police',
          status: 'deployed',
          location: {
            base: 'Kotwali Police Station',
            current: {
              address: 'En Route to Emergency',
              coordinates: { lat: 28.6800, lng: 77.4400 }
            }
          },
          members: [
            { name: 'SI Rakesh Singh', role: 'Station In-Charge', isLeader: true, contactNumber: '+91-9876543240' },
            { name: 'Constable Mohan', role: 'Police Constable', contactNumber: '+91-9876543241' },
            { name: 'Constable Sunil', role: 'Police Constable', contactNumber: '+91-9876543242' }
          ],
          equipment: [
            { item: 'Police Vehicle', quantity: 1, status: 'operational' },
            { item: 'Communication Equipment', quantity: 1, status: 'operational' },
            { item: 'Traffic Control Equipment', quantity: 1, status: 'operational' }
          ],
          specializations: ['crowd control', 'traffic management', 'evacuation coordination'],
          contact: {
            primaryPhone: '+91-9876543240',
            radio: 'POLICE-DELTA-1',
            email: 'police.delta@ghaziabad.gov.in'
          },
          currentAssignment: {
            assignedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            priority: 'high'
          }
        }
      ];

      for (const teamData of defaultTeams) {
        const team = new Team(teamData);
        await team.save();
        console.log(`✅ Seeded team: ${team.name}`);
      }
      
      console.log(`🚒 Seeded ${defaultTeams.length} response teams`);
    }
  } catch (error) {
    console.error('Error seeding teams:', error);
  }
};

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    
    await initializeSensors();
    await seedTeams();
    
    console.log('✅ Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };