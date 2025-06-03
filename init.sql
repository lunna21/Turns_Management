-- Create Database
CREATE DATABASE IF NOT EXISTS turns_db;
USE turns_db;

-- Drop tables if they exist to ensure a clean slate (optional, but good for development)
DROP TABLE IF EXISTS `schedule`;
DROP TABLE IF EXISTS `turn`;

-- Table: `turn`
CREATE TABLE IF NOT EXISTS `turn` (
  `id_turn` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `max_capacity` INT,
  `day` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'),
  `status` ENUM('active', 'inactive'),
  `start_time` TIME,
  `end_time` TIME,
  `created_turn_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_turn_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `color_turn` VARCHAR(30)
);

-- Table: `schedule`
CREATE TABLE IF NOT EXISTS `schedule` (
  `id_schedule` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `date_schedule` DATETIME,
  `id_student` VARCHAR(36),
  `id_turn` INT,
  `official_id` INT, 
  `state_schedule` ENUM('scheduled', 'attended', 'cancelled'),
  `created_schedule_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_schedule_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`id_turn`) REFERENCES `turn`(`id_turn`)
);