const { pool } = require("../config/db");
const axios = require("axios");

// Configuración del servicio de friendship-streak
const FRIENDSHIP_STREAK_SERVICE_URL = process.env.FRIENDSHIP_STREAK_SERVICE_URL || "http://localhost:3001";

const findCurrentScheduledTurn = async (studentId) => {
  const [schedules] = await pool.query(
    `SELECT 
            s.*,
            t.day AS turn_day,
            t.start_time AS turn_start_time,
            t.end_time AS turn_end_time
        FROM schedule s
        JOIN turn t ON s.id_turn = t.id_turn
        WHERE s.id_student = ? AND s.state_schedule = 'scheduled'
        ORDER BY s.date_schedule ASC, t.start_time ASC`,
    [studentId]
  );

  if (schedules.length === 0) {
    return null;
  }

  const now = new Date();
  const daysOfWeek = [
    "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", 
    "THURSDAY", "FRIDAY", "SATURDAY"
  ];

  for (const schedule of schedules) {
    const scheduleDateTime = new Date(schedule.date_schedule);
    const turnDayIndex = daysOfWeek.indexOf(schedule.turn_day.toUpperCase());

    if (scheduleDateTime.getDay() === turnDayIndex && scheduleDateTime <= now) {
      return schedule;
    }
  }

  return null;
};

// Función para obtener estudiantes en el mismo turno HOY
const getStudentsInSameTurnToday = async (studentId) => {
  try {
    const currentSchedule = await findCurrentScheduledTurn(studentId);
    if (!currentSchedule) return [];

    const today = new Date().toISOString().split('T')[0];
    
    const [students] = await pool.query(
      `SELECT DISTINCT s.id_student
       FROM schedule s
       JOIN turn t ON s.id_turn = t.id_turn
       WHERE s.id_turn = ? 
       AND DATE(s.date_schedule) = ?
       AND s.id_student != ?
       AND s.state_schedule IN ('scheduled', 'attended')`,
      [currentSchedule.id_turn, today, studentId]
    );

    return students.map(s => s.id_student);
  } catch (error) {
    console.error("Error getting students in same turn:", error);
    return [];
  }
};

// Función para verificar si un estudiante asistió hoy
const checkStudentAttendanceToday = async (studentId) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [attendance] = await pool.query(
      `SELECT s.* FROM schedule s
       WHERE s.id_student = ? 
       AND s.state_schedule = 'attended'
       AND DATE(s.updated_schedule_time) = ?`,
      [studentId, today]
    );

    return attendance.length > 0;
  } catch (error) {
    console.error("Error checking student attendance:", error);
    return false;
  }
};

// Función para notificar al servicio friendship-streak sobre encuentros
const notifyFriendshipEncounter = async (studentId1, studentId2) => {
  try {
    const response = await axios.post(`${FRIENDSHIP_STREAK_SERVICE_URL}/api/streak/streaks/update`, {
      userId1: studentId1,
      userId2: studentId2,
      date: new Date().toISOString().split('T')[0]
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log(`✅ Friendship encounter notified: ${studentId1} <-> ${studentId2}`);
    return response.data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.warn('⚠️ Friendship-streak service is not available');
    } else {
      console.error("❌ Error notifying friendship encounter:", error.message);
    }
    return null;
  }
};

// Función para verificar si dos estudiantes son amigos
const checkFriendshipExists = async (studentId1, studentId2) => {
  try {
    const response = await axios.get(`${FRIENDSHIP_STREAK_SERVICE_URL}/api/streak/friendships/${studentId1}`, {
      timeout: 5000
    });

    const friendships = response.data?.data || [];
    return friendships.some(friendship => friendship.friendId === studentId2);
  } catch (error) {
    console.error("Error checking friendship:", error);
    return false;
  }
};

// Función para procesar encuentros de amistades
const processFriendshipEncounters = async (studentId) => {
  try {
    console.log(`🔍 Processing friendship encounters for student: ${studentId}`);
    
    // Obtener estudiantes en el mismo turno hoy
    const studentsInSameTurn = await getStudentsInSameTurnToday(studentId);
    
    console.log(`👥 Students in same turn today: ${studentsInSameTurn.length}`);
    
    for (const otherStudentId of studentsInSameTurn) {
      // Verificar si el otro estudiante también asistió hoy
      const otherStudentAttended = await checkStudentAttendanceToday(otherStudentId);
      
      if (otherStudentAttended) {
        console.log(`✅ Both students attended: ${studentId} and ${otherStudentId}`);
        
        // Verificar si son amigos
        const areFriends = await checkFriendshipExists(studentId, otherStudentId);
        
        if (areFriends) {
          console.log(`👫 Friendship exists between ${studentId} and ${otherStudentId}`);
          
          // Notificar encuentro al servicio friendship-streak
          await notifyFriendshipEncounter(studentId, otherStudentId);
        } else {
          console.log(`👤 No friendship between ${studentId} and ${otherStudentId}`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error processing friendship encounters:", error);
  }
};

exports.markAttendance = async (req, res) => {
  const { student_id, official_id } = req.body;

  if (!student_id || !official_id) {
    return res.status(400).json({
      message: "student_id and official_id are required in the request body.",
    });
  }

  try {
    const currentSchedule = await findCurrentScheduledTurn(student_id);

    if (!currentSchedule) {
      return res.status(404).json({
        message: "No scheduled turn found for this student on or before today.",
      });
    }

    // Actualizar el schedule como attended
    const [result] = await pool.query(
      "UPDATE schedule SET state_schedule = ?, updated_schedule_time = NOW() WHERE id_schedule = ?",
      ["attended", currentSchedule.id_schedule]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        message: "Schedule not found or no changes made." 
      });
    }

    // Procesar encuentros de amistad después de marcar asistencia
    await processFriendshipEncounters(student_id);

    const [updatedSchedule] = await pool.query(
      "SELECT * FROM schedule WHERE id_schedule = ?",
      [currentSchedule.id_schedule]
    );

    res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      data: updatedSchedule[0]
    });

  } catch (error) {
    console.error("Error marking attendance:", error);
    res.status(500).json({
      message: "Error marking attendance",
      error: error.message,
    });
  }
};

exports.cancelAttendance = async (req, res) => {
  const { student_id } = req.body;

  if (!student_id) {
    return res.status(400).json({
      message: "student_id is required in the request body.",
    });
  }

  try {
    const currentSchedule = await findCurrentScheduledTurn(student_id);

    if (!currentSchedule) {
      return res.status(404).json({
        message: "No scheduled turn found for this student on or before today.",
      });
    }

    const [result] = await pool.query(
      "UPDATE schedule SET state_schedule = ?, updated_schedule_time = NOW() WHERE id_schedule = ?",
      ["cancelled", currentSchedule.id_schedule]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        message: "Schedule not found or no changes made." 
      });
    }

    const [updatedSchedule] = await pool.query(
      "SELECT * FROM schedule WHERE id_schedule = ?",
      [currentSchedule.id_schedule]
    );

    res.status(200).json({
      success: true,
      message: "Attendance cancelled successfully",
      data: updatedSchedule[0]
    });

  } catch (error) {
    console.error("Error cancelling attendance:", error);
    res.status(500).json({
      message: "Error cancelling attendance",
      error: error.message,
    });
  }
};

// Función auxiliar para obtener estadísticas de encuentros
exports.getEncounterStats = async (req, res) => {
  const { student_id } = req.params;

  try {
    const studentsInSameTurn = await getStudentsInSameTurnToday(student_id);
    
    const stats = {
      studentId: student_id,
      studentsInSameTurnToday: studentsInSameTurn.length,
      studentsInSameTurn: studentsInSameTurn
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error("Error getting encounter stats:", error);
    res.status(500).json({
      message: "Error getting encounter stats",
      error: error.message,
    });
  }
};
